// Simple JavaScript for interactivity

// CTA Button Alert
document.getElementById('cta-btn').addEventListener('click', function() {
    alert('Thank you for your interest! We\'ll contact you soon for a free consultation.');
});

// Form Submission Handler
document.getElementById('contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // Simulate form submission (replace with actual backend logic)
    alert(`Thank you, ${name}! Your message has been sent. We'll respond to ${email} soon.`);
    
    // Clear form
    this.reset();
});

// Smooth Scrolling for Nav Links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        targetSection.scrollIntoView({ behavior: 'smooth' });
    });
});