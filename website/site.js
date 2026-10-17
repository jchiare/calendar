const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

function updateHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 8);
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  nav?.classList.toggle("open", !isOpen);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav?.classList.contains("open")) {
    nav.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.focus();
  }
});

// Fade sections in as they scroll into view. Content stays visible without JS
// because the `reveal` class is only added here.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const element of document.querySelectorAll("[data-reveal]")) {
    element.classList.add("reveal");
    observer.observe(element);
  }
}

for (const element of document.querySelectorAll("[data-year]")) {
  element.textContent = String(new Date().getFullYear());
}

// A static site has no server to receive the form, so it opens an email draft
// to the clinic. Point `data-endpoint` at a form service to post instead.
const form = document.querySelector("#contact-form");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = form.querySelector(".form-status");
  const data = new FormData(form);
  const endpoint = form.dataset.endpoint;

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: data,
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      status.textContent =
        "Thank you! We received your message and will be in touch soon.";
    } catch {
      status.textContent =
        "Sorry, your message didn't send. Please call (555) 010-2468 or email hello@littlelantern.example.";
    }
    return;
  }

  const details = [
    `Name: ${data.get("firstName")} ${data.get("lastName")}`,
    `Email: ${data.get("email")}`,
    `Phone: ${data.get("phone")}`,
    `Zip code: ${data.get("zip")}`,
    `Child currently receives speech therapy: ${data.get("currentServices")}`,
    `Insurance provider: ${data.get("insurance")}`,
  ];
  if (data.get("insured")) details.push(`Name of insured: ${data.get("insured")}`);
  const message = String(data.get("message") || "").trim();
  const body = message ? `${details.join("\n")}\n\n${message}` : details.join("\n");
  const subject = `New family inquiry from ${data.get("firstName")}`;
  window.location.href = `mailto:hello@littlelantern.example?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
  status.textContent =
    "Your email app should open with your message ready to send. If it doesn't, email hello@littlelantern.example directly.";
});
