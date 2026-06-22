/**
 * Office of Municipal Accountant — Application Logic
 * Reads settings from config.js and syncs with Firebase Realtime Database.
 */

(function () {
  "use strict";

  let db = null;
  let postsCache = [];
  let currentFilter = "all";
  let editingPostId = null;
  let isAdminSession = false;
  const ADMIN_SESSION_KEY = "omaAdminSession";
  const REACTIONS = [
    { key: "like", label: "Like", icon: "👍" },
    { key: "heart", label: "Heart", icon: "❤️" },
    { key: "wow", label: "Wow", icon: "😮" },
    { key: "celebrate", label: "Celebrate", icon: "🎉" },
  ];
  const FILE_LIMITS_MB = {
    image: 20,
    video: 50,
    document: 20,
  };

  // ── Initialize ─────────────────────────────────────────────
  function init() {
    isAdminSession = getStoredAdminSession();
    applySiteConfig();
    initFirebase();
    bindEvents();
    initScrollEffects();
    loadPosts();
  }

  function applySiteConfig() {
    const c = SITE_CONFIG;

    document.title = c.site.title;
    setText("logoText", c.site.title);

    const logoImg = document.getElementById("logoImg");
    if (logoImg && c.site.logoImage) {
      logoImg.src = c.site.logoImage;
      logoImg.alt = c.site.title;
    } else if (logoImg) {
      logoImg.style.display = "none";
    }
    setText("heroTagline", c.site.tagline);
    setText("heroSubtitle", c.site.subtitle);
    setText("footerText", c.site.footerText);
    setText("footerBrand", c.site.title);
    setText("aboutHeading", c.about.heading);
    setText("aboutContent", c.about.content.trim());
    setText("aboutMission", c.about.mission);
    setText("aboutVision", c.about.vision);

    const heroBg = document.getElementById("heroBg");
    if (heroBg) heroBg.style.backgroundImage = `url('${c.site.heroImage}')`;

    renderNav(c.nav);
    renderServices(c.services);
    renderContact(c.contact);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderNav(links) {
    const nav = document.getElementById("mainNav");
    if (!nav) return;

    nav.innerHTML = links
      .map((l) => `<a href="${l.href}">${l.label}</a>`)
      .join("") + `<a href="#admin" class="admin-btn" id="adminBtn">${isAdminSession ? "Admin View" : "Admin Login"}</a>`;
  }

  function renderServices(services) {
    const grid = document.getElementById("servicesGrid");
    if (!grid) return;

    grid.innerHTML = services
      .map(
        (s, index) => `
      <div class="service-card reveal">
        <div class="service-icon">${s.icon}</div>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.description)}</p>
        ${s.requirements ? `<button class="service-details-btn" type="button" onclick="App.openServiceDetails(${index})">View requirements</button>` : ""}
      </div>`
      )
      .join("");
  }

  function openServiceDetails(index) {
    const service = SITE_CONFIG.services[index];
    if (!service || !service.requirements) return;

    setText("serviceDetailTitle", service.title);
    setText("serviceDetailDesc", service.details || service.description);
    setText("serviceDetailNote", service.note || "");

    const list = document.getElementById("serviceRequirementsList");
    if (list) {
      list.innerHTML = service.requirements
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    }

    openModal("serviceDetailModal");
  }

  function renderContact(contact) {
    const grid = document.getElementById("contactGrid");
    if (!grid) return;

    grid.innerHTML = `
      <div class="contact-card reveal">
        <div class="contact-card-icon">📍</div>
        <h4>Address</h4>
        <p>${escapeHtml(contact.officeName)}<br>${escapeHtml(contact.address)}<br>${escapeHtml(contact.city)}</p>
      </div>
      <div class="contact-card reveal">
        <div class="contact-card-icon">✉️</div>
        <h4>Email</h4>
        <p><a href="mailto:${contact.email}">${escapeHtml(contact.email)}</a></p>
      </div>
      <div class="contact-card reveal">
        <div class="contact-card-icon">📞</div>
        <h4>Phone</h4>
        <p><a href="tel:${contact.phone.replace(/\D/g, "")}">${escapeHtml(contact.phone)}</a></p>
      </div>
      <div class="contact-card reveal">
        <div class="contact-card-icon">🕐</div>
        <h4>Office Hours</h4>
        <p>${escapeHtml(contact.hours)}</p>
      </div>`;
  }

  // ── Firebase ───────────────────────────────────────────────
  function initFirebase() {
    if (typeof firebase === "undefined") {
      setTimeout(initFirebase, 100);
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(SITE_CONFIG.firebase);
      }
      db = firebase.database();
    } catch (err) {
      showToast("Firebase connection failed. Check config.js settings.", "error");
      console.error(err);
    }
  }

  function dbRef(path) {
    if (!db) throw new Error("Database not initialized");
    return db.ref(path);
  }

  // ── Posts / Updates ────────────────────────────────────────
  function loadPosts() {
    if (!db) {
      setTimeout(loadPosts, 200);
      return;
    }

    dbRef("posts").on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        postsCache = Object.values(data).sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        renderPosts();
        updatePostCount();
      } else {
        // Fallback: load legacy "activities" data if posts node is empty
        dbRef("activities").once("value", (legacySnap) => {
          const legacy = legacySnap.val();
          postsCache = legacy
            ? Object.values(legacy)
                .map((a) => ({
                  id: a.id,
                  title: a.title,
                  description: a.description,
                  fullContent: a.description,
                  category: "Activity",
                  image: a.image || SITE_CONFIG.defaultPostImage,
                  mediaType: "image",
                  mediaUrl: a.image || SITE_CONFIG.defaultPostImage,
                  fileName: "",
                  fileMimeType: "",
                  reactions: defaultReactions(),
                  timestamp: a.timestamp || new Date().toISOString(),
                }))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            : [];
          renderPosts();
          updatePostCount();
        });
      }
    });
  }

  function renderPosts() {
    const grid = document.getElementById("postsGrid");
    if (!grid) return;

    let filtered = postsCache;
    if (currentFilter !== "all") {
      filtered = postsCache.filter((p) => p.category === currentFilter);
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📰</div>
          <p>No updates posted yet. Check back soon!</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (post) => {
          const media = getPostMedia(post);
          return `
      <article class="post-card reveal" data-id="${post.id}" onclick="App.openPost('${post.id}')">
        ${renderPostMedia(media, post.title)}
        <div class="post-body">
          <div class="post-meta">
            <span class="post-category">${escapeHtml(post.category || "Update")}</span>
            <span class="post-date">${formatDate(post.timestamp)}</span>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.description)}</p>
          ${renderReactions(post)}
          <span class="post-read-more">Read more →</span>
        </div>
      </article>`;
        }
      )
      .join("");

    observeReveal();
  }

  function updatePostCount() {
    const el = document.getElementById("statPosts");
    if (el) el.textContent = postsCache.length;
  }

  function openPost(id) {
    const post = postsCache.find((p) => p.id === id);
    if (!post) return;

    const mediaEl = document.getElementById("postDetailMedia");
    if (mediaEl) {
      mediaEl.innerHTML = renderPostMedia(getPostMedia(post), post.title, true);
    }
    document.getElementById("postDetailCategory").textContent = post.category || "Update";
    document.getElementById("postDetailDate").textContent = formatDate(post.timestamp);
    document.getElementById("postDetailTitle").textContent = post.title;
    document.getElementById("postDetailContent").textContent = post.fullContent || post.description;
    const reactionsEl = document.getElementById("postDetailReactions");
    if (reactionsEl) reactionsEl.innerHTML = renderReactions(post, true);

    openModal("postDetailModal");
  }

  async function savePost(e) {
    e.preventDefault();
    if (!requireAdmin()) return;
    if (!db) return showToast("Database not connected.", "error");

    const id = editingPostId || Date.now().toString();
    const existingPost = editingPostId
      ? postsCache.find((p) => p.id === editingPostId)
      : null;
    let uploadedMedia = null;

    try {
      uploadedMedia = await readSelectedMedia();
    } catch (err) {
      showToast(err.message, "error");
      return;
    }

    const media = resolvePostMedia(uploadedMedia, existingPost);
    const post = {
      id,
      title: document.getElementById("postTitle").value.trim(),
      description: document.getElementById("postDescription").value.trim(),
      fullContent: document.getElementById("postFullContent").value.trim(),
      category: document.getElementById("postCategory").value,
      image: media.type === "image" ? media.url : SITE_CONFIG.defaultPostImage,
      video: media.type === "video" ? media.url : "",
      document: media.type === "document" ? media.url : "",
      mediaType: media.type,
      mediaUrl: media.url,
      fileName: media.fileName || "",
      fileMimeType: media.mimeType || "",
      reactions: existingPost?.reactions || defaultReactions(),
      timestamp: editingPostId
        ? existingPost?.timestamp || new Date().toISOString()
        : new Date().toISOString(),
    };

    dbRef("posts/" + id)
      .set(post)
      .then(() => {
        closeModal("postFormModal");
        resetPostForm();
        showToast(editingPostId ? "Post updated!" : "Post published!", "success");
        editingPostId = null;
      })
      .catch((err) => showToast("Error saving post: " + err.message, "error"));
  }

  function editPost(id) {
    if (!requireAdmin()) return;

    const post = postsCache.find((p) => p.id === id);
    if (!post) return;

    editingPostId = id;
    document.getElementById("postFormTitle").textContent = "Edit Post";
    document.getElementById("postTitle").value = post.title;
    document.getElementById("postDescription").value = post.description;
    document.getElementById("postFullContent").value = post.fullContent || "";
    document.getElementById("postCategory").value = post.category || "Update";
    document.getElementById("postImage").value =
      post.mediaType !== "video" && post.image && post.image !== SITE_CONFIG.defaultPostImage && !isDataUrl(post.image)
        ? post.image
        : "";
    document.getElementById("postVideo").value =
      post.mediaType === "video" && post.video && !isDataUrl(post.video)
        ? post.video
        : "";

    openModal("postFormModal");
  }

  function deletePost(id) {
    if (!requireAdmin()) return;

    if (!confirm("Delete this post permanently?")) return;

    dbRef("posts/" + id)
      .remove()
      .then(() => showToast("Post deleted.", "success"))
      .catch((err) => showToast("Error: " + err.message, "error"));
  }

  function clearPostReactions(id) {
    if (!requireAdmin()) return;

    const post = postsCache.find((p) => p.id === id);
    if (!post) return;

    if (!confirm(`Clear all reactions for "${post.title}"?`)) return;

    dbRef("posts/" + id + "/reactions")
      .set(defaultReactions())
      .then(() => showToast("Post reactions cleared.", "success"))
      .catch((err) => showToast("Error: " + err.message, "error"));
  }

  function resetPostForm() {
    editingPostId = null;
    document.getElementById("postFormTitle").textContent = "Add New Post";
    document.getElementById("postForm").reset();
  }

  function reactToPost(id, reactionKey, event) {
    event?.stopPropagation();
    if (!db) return showToast("Database not connected.", "error");
    if (!REACTIONS.some((reaction) => reaction.key === reactionKey)) return;

    dbRef(`posts/${id}/reactions/${reactionKey}`)
      .transaction((count) => (count || 0) + 1)
      .catch((err) => showToast("Reaction failed: " + err.message, "error"));
  }

  function defaultReactions() {
    return REACTIONS.reduce((counts, reaction) => {
      counts[reaction.key] = 0;
      return counts;
    }, {});
  }

  function renderReactions(post, isDetail) {
    const counts = { ...defaultReactions(), ...(post.reactions || {}) };
    const extraClass = isDetail ? " is-detail" : "";

    return `
      <div class="post-reactions${extraClass}">
        ${REACTIONS.map(
          (reaction) => `
          <button class="reaction-btn" type="button" aria-label="${reaction.label}" onclick="App.reactToPost('${post.id}', '${reaction.key}', event)">
            <span class="reaction-icon">${reaction.icon}</span>
            <span class="reaction-count">${counts[reaction.key] || 0}</span>
          </button>`
        ).join("")}
      </div>`;
  }

  function getPostMedia(post) {
    if (post.mediaType === "video" && (post.mediaUrl || post.video)) {
      return { type: "video", url: post.mediaUrl || post.video };
    }

    if (post.mediaType === "document" && (post.mediaUrl || post.document)) {
      return {
        type: "document",
        url: post.mediaUrl || post.document,
        fileName: post.fileName || "Attached document",
        mimeType: post.fileMimeType || "",
      };
    }

    if (post.video) {
      return { type: "video", url: post.video };
    }

    return {
      type: "image",
      url: post.mediaUrl || post.image || SITE_CONFIG.defaultPostImage,
    };
  }

  function renderPostMedia(media, title, isDetail) {
    const safeUrl = escapeHtml(media.url || SITE_CONFIG.defaultPostImage);
    const safeTitle = escapeHtml(title || "Post media");
    const detailClass = isDetail ? " post-media-detail" : "";

    if (media.type === "video") {
      return `
        <div class="post-image-wrap post-video-wrap${detailClass}">
          <video class="post-video" src="${safeUrl}" muted loop autoplay playsinline preload="metadata" ${isDetail ? "controls" : ""}></video>
          <span class="media-badge">Video</span>
        </div>`;
    }

    if (media.type === "document") {
      const fileName = escapeHtml(media.fileName || "Attached document");
      const fileKind = getDocumentLabel(media.fileName, media.mimeType);
      return `
        <div class="post-document-wrap${detailClass}">
          <div class="document-icon">${fileKind.icon}</div>
          <div class="document-info">
            <span class="document-label">${fileKind.label}</span>
            <strong>${fileName}</strong>
            <a href="${safeUrl}" download="${fileName}" onclick="event.stopPropagation()">Download file</a>
          </div>
        </div>`;
    }

    return `
      <div class="post-image-wrap${detailClass}">
        <img class="post-image" src="${safeUrl}" alt="${safeTitle}" loading="lazy">
      </div>`;
  }

  function resolvePostMedia(uploadedMedia, existingPost) {
    const imageUrl = document.getElementById("postImage").value.trim();
    const videoUrl = document.getElementById("postVideo").value.trim();

    if (uploadedMedia) return uploadedMedia;
    if (videoUrl) return { type: "video", url: videoUrl };
    if (imageUrl) return { type: "image", url: imageUrl };
    if (existingPost) return getPostMedia(existingPost);

    return { type: "image", url: SITE_CONFIG.defaultPostImage };
  }

  function getDocumentLabel(fileName, mimeType) {
    const name = (fileName || "").toLowerCase();
    const mime = (mimeType || "").toLowerCase();

    if (name.endsWith(".pdf") || mime.includes("pdf")) {
      return { icon: "PDF", label: "PDF File" };
    }

    if (name.endsWith(".doc") || name.endsWith(".docx") || mime.includes("word")) {
      return { icon: "DOC", label: "Word File" };
    }

    if (name.endsWith(".xls") || name.endsWith(".xlsx") || mime.includes("excel") || mime.includes("spreadsheet")) {
      return { icon: "XLS", label: "Excel File" };
    }

    return { icon: "FILE", label: "Document" };
  }

  function readSelectedMedia() {
    const input = document.getElementById("postMediaFile");
    const file = input?.files?.[0];
    if (!file) return Promise.resolve(null);

    const fileType = getUploadType(file);
    if (!fileType) {
      return Promise.reject(new Error("Please choose an image, video, PDF, Word or Excel file."));
    }

    const limitMb = FILE_LIMITS_MB[fileType];
    if (file.size > limitMb * 1024 * 1024) {
      return Promise.reject(new Error(`Please choose a ${fileType} file under ${limitMb} MB.`));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          type: fileType,
          url: reader.result,
          fileName: file.name,
          mimeType: file.type,
        });
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  function getUploadType(file) {
    const name = file.name.toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const documentExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
    const documentMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (
      documentExtensions.some((extension) => name.endsWith(extension)) ||
      documentMimes.includes(mime)
    ) {
      return "document";
    }

    return "";
  }

  function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
  }

  function renderAdminPosts() {
    const list = document.getElementById("adminPostsList");
    if (!list) return;

    if (postsCache.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No posts yet.</p>`;
      return;
    }

    list.innerHTML = postsCache
      .map(
        (post) => `
      <div class="admin-item">
        <div class="admin-item-content">
          <h4>${escapeHtml(post.title)}</h4>
          <p>${escapeHtml(post.description)}</p>
          <div class="admin-item-meta">${formatDate(post.timestamp)} · ${escapeHtml(post.category || "Update")}</div>
        </div>
        <div class="admin-actions">
          <button class="btn-sm btn-edit" onclick="App.editPost('${post.id}')">Edit</button>
          <button class="btn-sm btn-clear" onclick="App.clearPostReactions('${post.id}')">Clear reactions</button>
          <button class="btn-sm btn-delete" onclick="App.deletePost('${post.id}')">Delete</button>
        </div>
      </div>`
      )
      .join("");
  }

  // ── Inquiries ──────────────────────────────────────────────
  function submitInquiry(e) {
    e.preventDefault();
    if (!db) return showToast("Database not connected.", "error");

    const btn = document.getElementById("inquirySubmit");
    btn.disabled = true;

    const id = Date.now().toString();
    const inquiry = {
      id,
      name: document.getElementById("inquiryName").value.trim(),
      email: document.getElementById("inquiryEmail").value.trim(),
      subject: document.getElementById("inquirySubject").value.trim(),
      message: document.getElementById("inquiryMessage").value.trim(),
      date: new Date().toISOString(),
      read: false,
    };

    dbRef("inquiries/" + id)
      .set(inquiry)
      .then(() => {
        document.getElementById("inquiryForm").reset();
        showToast("Thank you! Your inquiry has been received.", "success");
      })
      .catch((err) => showToast("Error: " + err.message, "error"))
      .finally(() => {
        btn.disabled = false;
      });
  }

  function loadInquiries() {
    if (!db) return;

    dbRef("inquiries").on("value", (snapshot) => {
      const data = snapshot.val();
      const inquiries = data
        ? Object.values(data).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          )
        : [];

      renderAdminInquiries(inquiries);

      const statEl = document.getElementById("statInquiries");
      if (statEl) statEl.textContent = inquiries.length;
    });
  }

  function renderAdminInquiries(inquiries) {
    const list = document.getElementById("adminInquiriesList");
    if (!list) return;

    if (inquiries.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No inquiries yet.</p>`;
      return;
    }

    list.innerHTML = inquiries
      .map(
        (inq) => `
      <div class="admin-item inquiry-admin-item ${inq.read ? "" : "unread"}">
        <div class="admin-item-content">
          <h4>${escapeHtml(inq.name)} <span style="font-weight:400;color:var(--text-muted);">— ${escapeHtml(inq.email)}</span></h4>
          <p><strong>Subject:</strong> ${escapeHtml(inq.subject)}</p>
          <p>${escapeHtml(inq.message)}</p>
          <div class="admin-item-meta">${formatDate(inq.date)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn-sm btn-delete" onclick="App.deleteInquiry('${inq.id}')">Delete</button>
        </div>
      </div>`
      )
      .join("");
  }

  function deleteInquiry(id) {
    if (!requireAdmin()) return;

    if (!confirm("Delete this inquiry?")) return;

    dbRef("inquiries/" + id)
      .remove()
      .then(() => showToast("Inquiry deleted.", "success"))
      .catch((err) => showToast("Error: " + err.message, "error"));
  }

  // ── Admin ──────────────────────────────────────────────────
  function openAdmin() {
    if (!isAdminSession) {
      openAdminLogin();
      return;
    }

    openAdminDashboard();
  }

  function openAdminLogin() {
    document.getElementById("adminLoginForm")?.reset();
    openModal("adminLoginModal");
    setTimeout(() => document.getElementById("adminPassword")?.focus(), 50);
  }

  function submitAdminLogin(e) {
    e.preventDefault();

    const password = document.getElementById("adminPassword").value;
    if (password !== SITE_CONFIG.adminPassword) {
      showToast("Incorrect password.", "error");
      return;
    }

    setAdminSession(true);
    closeModal("adminLoginModal");
    showToast("Admin session started.", "success");
    openAdminDashboard();
  }

  function openAdminDashboard() {
    renderAdminPosts();
    loadInquiries();
    switchAdminTab("posts");
    openModal("adminModal");
  }

  function logoutAdmin() {
    setAdminSession(false);
    closeModal("adminModal");
    closeModal("postFormModal");
    showToast("Logged out of admin view.", "success");
  }

  function setAdminSession(value) {
    isAdminSession = value;

    if (value) {
      localStorage.setItem(ADMIN_SESSION_KEY, "1");
      document.body.classList.add("admin-session");
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      document.body.classList.remove("admin-session");
    }

    const adminBtn = document.getElementById("adminBtn");
    if (adminBtn) adminBtn.textContent = value ? "Admin View" : "Admin Login";
  }

  function getStoredAdminSession() {
    const isStored = localStorage.getItem(ADMIN_SESSION_KEY) === "1";
    document.body.classList.toggle("admin-session", isStored);
    return isStored;
  }

  function requireAdmin() {
    if (isAdminSession) return true;
    showToast("Please log in to use admin tools.", "error");
    openAdminLogin();
    return false;
  }

  function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    document.querySelectorAll(".admin-panel").forEach((p) => {
      p.classList.toggle("active", p.id === "panel-" + tab);
    });
  }

  // ── Modals ─────────────────────────────────────────────────
  function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  // ── UI Helpers ─────────────────────────────────────────────
  function showToast(message, type) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast" + (type ? " " + type : "");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function initScrollEffects() {
    const header = document.querySelector(".header");
    window.addEventListener("scroll", () => {
      header?.classList.toggle("scrolled", window.scrollY > 20);
    });

    observeReveal();
  }

  function observeReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".reveal:not(.visible)").forEach((el) => {
      observer.observe(el);
    });
  }

  // ── Event Bindings ─────────────────────────────────────────
  function bindEvents() {
    document.addEventListener("click", (e) => {
      if (e.target.id === "adminBtn" || e.target.closest("#adminBtn")) {
        e.preventDefault();
        openAdmin();
      }

      if (e.target.classList.contains("filter-tab")) {
        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        currentFilter = e.target.dataset.filter;
        renderPosts();
      }

      if (e.target.classList.contains("admin-tab")) {
        switchAdminTab(e.target.dataset.tab);
      }

      if (e.target.classList.contains("modal-overlay")) {
        closeModal(e.target.id);
      }

      if (e.target.classList.contains("modal-close")) {
        const modal = e.target.closest(".modal-overlay");
        if (modal) closeModal(modal.id);
      }
    });

    document.getElementById("menuToggle")?.addEventListener("click", () => {
      document.getElementById("mainNav")?.classList.toggle("open");
    });

    document.getElementById("inquiryForm")?.addEventListener("submit", submitInquiry);
    document.getElementById("postForm")?.addEventListener("submit", savePost);
    document.getElementById("adminLoginForm")?.addEventListener("submit", submitAdminLogin);
    document.getElementById("adminLogoutBtn")?.addEventListener("click", logoutAdmin);

    document.getElementById("addPostBtn")?.addEventListener("click", () => {
      if (!requireAdmin()) return;
      resetPostForm();
      openModal("postFormModal");
    });

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", () => {
        document.getElementById("mainNav")?.classList.remove("open");
      });
    });

    if (window.location.hash === "#admin") {
      openAdmin();
    }
  }

  // ── Public API ─────────────────────────────────────────────
  window.App = {
    openPost,
    openServiceDetails,
    editPost,
    deletePost,
    clearPostReactions,
    reactToPost,
    deleteInquiry,
    logoutAdmin,
    openModal,
    closeModal,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
