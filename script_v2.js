// Smooth-ish nav highlighting & mobile menu

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = [...document.querySelectorAll("main section")];
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");
  const yearSpan = document.getElementById("year");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Mobile nav toggle
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      mainNav.classList.toggle("is-open");
    });
  }

  // Close mobile nav when clicking a link
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
    });
  });

  // Basic active state based on scroll
  window.addEventListener("scroll", () => {
    const scrollPos = window.scrollY + 90;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = top + section.offsetHeight;
      const id = section.getAttribute("id");

      if (id && scrollPos >= top && scrollPos < bottom) {
        navLinks.forEach((l) => l.classList.remove("is-active"));
        const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
        if (activeLink) activeLink.classList.add("is-active");
      }
    });
  });

  // HERO DEVICE CAROUSEL
  const slides = document.querySelectorAll(".device-slide");
  const dots = document.querySelectorAll(".device-dots .dot");
  let currentSlide = 0;
  let slideTimer;

  function goToSlide(idx) {
    slides.forEach((s) => s.classList.remove("is-active"));
    dots.forEach((d) => d.classList.remove("is-active"));
    slides[idx].classList.add("is-active");
    dots[idx].classList.add("is-active");
    currentSlide = idx;
  }

  function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
  }

  if (slides.length && dots.length) {
    dots.forEach((dot, idx) => {
      dot.addEventListener("click", () => {
        goToSlide(idx);
        restartTimer();
      });
    });

    slideTimer = setInterval(nextSlide, 5000);
  }

  function restartTimer() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = setInterval(nextSlide, 5000);
    }
  }

  // PARTNER MATERIALS GATE
  const ACCESS_CODE = "MYFI2025"; // TODO: change this to your real code
  const gate = document.getElementById("partner-gate");
  const partnerContent = document.getElementById("partner-content");
  const unlockBtn = document.getElementById("partner-unlock");
  const codeInput = document.getElementById("partner-code");
  const messageEl = document.getElementById("partner-message");

  function showPartnerContent() {
    if (gate) gate.style.display = "none";
    if (partnerContent) {
      partnerContent.classList.add("is-visible");
      partnerContent.setAttribute("aria-hidden", "false");
    }
  }

  // Check localStorage (so they don't need to re-enter every visit)
  try {
    const unlocked = window.localStorage.getItem("myfiPartnerUnlocked");
    if (unlocked === "true") {
      showPartnerContent();
    }
  } catch (e) {
    // ignore if storage unavailable
  }

  function handleUnlock() {
    const code = codeInput?.value.trim();
    if (!code) return;

    if (code === ACCESS_CODE) {
      if (messageEl) {
        messageEl.textContent = "Access granted.";
        messageEl.classList.remove("error");
        messageEl.classList.add("success");
      }
      showPartnerContent();
      try {
        window.localStorage.setItem("myfiPartnerUnlocked", "true");
      } catch (e) {}
    } else {
      if (messageEl) {
        messageEl.textContent = "Incorrect code. Check your invite and try again.";
        messageEl.classList.remove("success");
        messageEl.classList.add("error");
      }
    }
  }

  if (unlockBtn) {
    unlockBtn.addEventListener("click", handleUnlock);
  }
  if (codeInput) {
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleUnlock();
      }
    });
  }

  // PARTNER TABS
  const tabButtons = document.querySelectorAll(".partner-tab");
  const tabPanels = document.querySelectorAll(".partner-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;

      tabButtons.forEach((b) => b.classList.remove("is-active"));
      tabPanels.forEach((panel) => {
        if (panel.getAttribute("data-panel") === target) {
          panel.classList.add("is-active");
        } else {
          panel.classList.remove("is-active");
        }
      });

      btn.classList.add("is-active");
    });
  });
});
