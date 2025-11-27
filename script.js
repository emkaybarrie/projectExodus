document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // NAVIGATION
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = ["hero", "about", "partnerships", "team"].map((id) =>
    document.getElementById(id)
  );
  const topLinks = document.querySelector(".top-links");
  const navToggle = document.querySelector(".nav-toggle");

  // Mobile toggle
  if (navToggle && topLinks) {
    navToggle.addEventListener("click", () => {
      topLinks.classList.toggle("is-open");
    });
  }

  // Close mobile menu on click
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      topLinks?.classList.remove("is-open");
    });
  });

  // Highlight nav on scroll
  window.addEventListener("scroll", () => {
    const y = window.scrollY + 80;
    sections.forEach((section) => {
      if (!section) return;
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      if (y >= top && y < bottom) {
        const id = section.id;
        navLinks.forEach((l) => l.classList.remove("is-active"));
        const active = document.querySelector(`.nav-link[href="#${id}"]`);
        active?.classList.add("is-active");
      }
    });
  });

  // PARTNER GATE
  const ACCESS_CODE = "MYFI2025"; // change this to whatever you want

  const codeInput = document.getElementById("partner-code");
  const unlockBtn = document.getElementById("partner-unlock");
  const messageEl = document.getElementById("partner-message");
  const pmTabsContainer = document.getElementById("partner-content");

  function showTabs() {
    pmTabsContainer?.classList.add("is-visible");
    pmTabsContainer?.setAttribute("aria-hidden", "false");
  }

  function unlock() {
    const value = codeInput?.value.trim();
    if (!value) return;

    if (value === ACCESS_CODE) {
      if (messageEl) {
        messageEl.textContent = "Access granted.";
        messageEl.classList.remove("error");
        messageEl.classList.add("success");
      }
      showTabs();
      try {
        localStorage.setItem("myfiPartnerUnlocked", "true");
      } catch {}
    } else {
      if (messageEl) {
        messageEl.textContent = "Incorrect code. Check your invite and try again.";
        messageEl.classList.remove("success");
        messageEl.classList.add("error");
      }
    }
  }

  // Restore state if previously unlocked
  try {
    const unlocked = localStorage.getItem("myfiPartnerUnlocked");
    if (unlocked === "true") {
      showTabs();
    }
  } catch {}

  unlockBtn?.addEventListener("click", unlock);
  codeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      unlock();
    }
  });

  // Partner tabs switching
  const tabButtons = document.querySelectorAll(".pm-tab");
  const tabPanels = document.querySelectorAll(".pm-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;

      tabButtons.forEach((b) => b.classList.remove("is-active"));
      tabPanels.forEach((panel) => {
        const id = panel.getAttribute("data-panel");
        if (id === target) {
          panel.classList.add("is-active");
        } else {
          panel.classList.remove("is-active");
        }
      });
      btn.classList.add("is-active");
    });
  });
});
