/* ===================================================================
   Atmos Drop: site settings. Edit this file, then re-upload it.
   Leave a value as "" to switch that feature off.
   =================================================================== */
window.ATMOS_CONFIG = {
  /* DATABASE (Supabase, free). Settings > API in your Supabase project.
     The "anon" key is meant to be public; the database rules protect your data. */
  SUPABASE_URL: "https://peoimyhahpefstcvgamu.supabase.co",        // e.g. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlb2lteWhhaHBlZnN0Y3ZnYW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDIzODMsImV4cCI6MjEwNzYxODM4M30.f-rAiI127dXVDOJDdxngWsO10IHFGYQ2fqk_WkTgsBI",   // the long "anon public" key

  /* PAYMENTS (optional). Orders are saved even if both are empty. */
  RAZORPAY_KEY_ID: "",     // e.g. "rzp_live_xxxxxxxx" (use rzp_test_... to test)
  UPI_ID: "",              // e.g. "atmosdrop@okhdfcbank"

  /* CONTACT */
  CONTACT_EMAIL: "AtmosDrop@help.in",       // shown on the site and used if the database is off
  WHATSAPP: "9875521531",            // country code + number, digits only, e.g. "919876543210"

  /* BUSINESS DETAILS (shown in the footer; Indian e-commerce rules expect these) */
  BUSINESS_NAME: "AtmosDrop",       // registered name of the seller
  BUSINESS_ADDRESS: "VIT-AP,AMARAVATHI,ANDHRA PRADESH",
  GSTIN: "",
  SUPPORT_PHONE: "9874562145"
};
