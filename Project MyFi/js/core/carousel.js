
  // document.addEventListener("DOMContentLoaded", () => {
  //   const carousel = document.getElementById("dashboard-carousel");
  //   const panels = carousel.querySelectorAll(".panel");
  //   const indicator = document.getElementById("panel-indicator");
  //   const toggleBtn = document.getElementById("mode-toggle-btn");

  //   let currentIndex = 1; // Default to HUD
  //   updateActiveDot(currentIndex);

  //   function scrollToPanel(index) {
  //     if (index < 0 || index >= panels.length) return;
  //     panels[index].scrollIntoView({ behavior: "smooth" });
  //     currentIndex = index;
  //     updateIndicator();
  //     updateActiveDot(currentIndex);
  //   }

  //   function updateIndicator() {
  //     if (indicator) {
  //       const header = panels[currentIndex].querySelector(".panel-header");
  //       indicator.innerText = `Panel: ${header ? header.innerText : currentIndex}`;
  //     }
  //   }

  //   function updateActiveDot(index) {
  //   document.querySelectorAll('.dot').forEach((dot, i) => {
  //     dot.classList.toggle('active', i === index);
  //   });
  // }

  //   // Swipe support (mobile)
  //   let startX = 0;
  //   carousel.addEventListener("touchstart", (e) => {
  //     startX = e.touches[0].clientX;
  //   });

  //   carousel.addEventListener("touchend", (e) => {
  //     const deltaX = e.changedTouches[0].clientX - startX;
  //     if (Math.abs(deltaX) > 50) {
  //       if (deltaX < 0) scrollToPanel(currentIndex + 1); // Swipe Left
  //       else scrollToPanel(currentIndex - 1);             // Swipe Right
  //     }
  //   });

  //   // Button toggle
  //   if (toggleBtn) {
  //     toggleBtn.addEventListener("click", () => {
  //       scrollToPanel((currentIndex + 1) % panels.length);
  //     });
  //   }

  //   scrollToPanel(currentIndex);
  // })

  // modules/carousel.js

export function initCarousel() {
  const carousel = document.getElementById("dashboard-carousel");
  const panels = carousel.querySelectorAll(".panel");
  const indicator = document.getElementById("panel-indicator");
  const toggleBtn = document.getElementById("mode-toggle-btn");

  let currentIndex = 1; // Default to HUD
  updateActiveDot(currentIndex);
  scrollToPanel(currentIndex);

  function scrollToPanel(index) {
    if (index < 0 || index >= panels.length) return;
    panels[index].scrollIntoView({ behavior: "smooth" });
    currentIndex = index;
    updateIndicator();
    updateActiveDot(currentIndex);
  }

  function updateIndicator() {
    if (indicator) {
      const header = panels[currentIndex].querySelector(".panel-header");
      indicator.innerText = `Panel: ${header ? header.innerText : currentIndex}`;
    }
  }

  function updateActiveDot(index) {
    document.querySelectorAll(".dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  // Swipe Support
  let startX = 0;
  carousel.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  carousel.addEventListener("touchend", (e) => {
    const deltaX = e.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) scrollToPanel(currentIndex + 1);
      else scrollToPanel(currentIndex - 1);
    }
  });

  // Toggle Button
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      scrollToPanel((currentIndex + 1) % panels.length);
    });
  }
}

