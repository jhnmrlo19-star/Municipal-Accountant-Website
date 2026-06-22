/**
 * ============================================================
 *  OFFICE OF MUNICIPAL ACCOUNTANT — SITE CONFIGURATION
 * ============================================================
 * Edit this file to update Firebase credentials, site content,
 * contact details, and admin access. No other files need changes
 * for routine updates.
 * ============================================================
 */

const SITE_CONFIG = {

  // ── Firebase Realtime Database ─────────────────────────────
  firebase: {
    apiKey: "AIzaSyBqfXwkM3BSJfJN5SQuQg2SxlXbLDJP2Cw",
    authDomain: "municipal-accountant.firebaseapp.com",
    databaseURL: "https://municipal-accountant-default-rtdb.firebaseio.com",
    projectId: "municipal-accountant",
    storageBucket: "municipal-accountant.firebasestorage.app",
    messagingSenderId: "976763117968",
    appId: "1:976763117968:web:72d44e19053923fe3c9315",
  },

  // ── Admin Access ───────────────────────────────────────────
  // Change this password before going live!
  adminPassword: "@ccounting2026",

  // ── Site Identity ──────────────────────────────────────────
  site: {
    title: "Office of the Municipal Accountant",
    shortTitle: "Municipal Accountant",
    tagline: "Transparency, Accountability & Service",
    subtitle: "Official Website of the Office of the Municipal Accountant",
    logoText: "MA", // Fallback if logoImage is empty
    logoImage: "images/logo.jpg", // Path to your logo file
    footerText: "© 2026 Office of the Municipal Accountant. All Rights Reserved.",
    heroImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&q=80",
  },

  // ── About Section ──────────────────────────────────────────
  about: {
    heading: "About the Office",
    content: `The Office of the Municipal Accountant is responsible for maintaining
financial records, preparing financial statements, ensuring compliance with
government accounting standards, and promoting transparency and accountability
in public financial management.`,
    mission: "To provide accurate, timely, and transparent financial information that supports good governance and public trust.",
    vision: "A model municipal accounting office recognized for excellence in public financial management.",
  },

  // ── Contact Information ────────────────────────────────────
  contact: {
    officeName: "Office of the Municipal Accountant",
    address: "Santo Domingo Municipal Hall Building",
    city: "Municipality of Santo Domingo, Nueva Ecija",
    email: "sdne.maiaso@gmail.com",
    phone: "(044) 123-4567",
    hours: "Monday – Friday, 8:00 AM – 5:00 PM",
    mapEmbed: "", // Optional: paste Google Maps embed URL here
  },

  // ── Navigation Links ───────────────────────────────────────
  nav: [
    { label: "About", href: "#about" },
    { label: "Updates", href: "#updates" },
    { label: "Services", href: "#services" },
    { label: "Inquiry", href: "#inquiry" },
    { label: "Contact", href: "#contact" },
  ],

  // ── Services (static cards — edit here) ────────────────────
  services: [
    {
      icon: "📊",
      title: "Financial Reporting",
      description: "Preparation and submission of accurate financial statements in compliance with COA standards.",
    },
    {
      icon: "🔍",
      title: "Audit Support",
      description: "Maintaining complete records and supporting documents for internal and external audits.",
    },
    {
      icon: "💼",
      title: "Budget Monitoring",
      description: "Tracking municipal fund utilization and ensuring proper allocation of public resources.",
    },
    {
      icon: "📋",
      title: "Compliance & Transparency",
      description: "Ensuring adherence to government accounting rules and promoting public accountability.",
    },
    {
      icon: "🏥",
      title: "PhilHealth Application and Payment",
      description: "Assistance for PhilHealth member registration, updating, and payment guidance for eligible clients.",
      details: "Applicants may prepare the following before visiting the office. Additional documents may be requested depending on membership type, declared dependents, or record updates. Ps. Our Process here takes 2 to 3 weeks. We will contact you when your ID and MDR where here.",
      requirements: [
        "Properly accomplished PhilHealth Member Registration Form (PMRF).",
        "Valid proof of identity for first-time registrants.",
        "PhilHealth Identification Number (PIN), if already registered.",
        "Supporting documents for declared dependents, when applicable.",
        "Proof of income for self-earning individuals, kasambahays, family drivers, and other direct contributors when required.",
        "Payment amount or contribution reference based on the applicable PhilHealth contribution schedule.",
      ],
      note: "Please bring original documents and clear photocopies when available.",
    },
  ],

  // ── Default Post Image (used when no image URL is provided) ─
  defaultPostImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
};
