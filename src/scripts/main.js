/**
 * main.js - Core functionality for IS3A3 2026 Website
 * Handles navigation, mobile menu, and animations.
 */

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initScrollAnimations();
    initFaqAccordion();
});

/**
 * Mobile Menu Toggle Logic
 */
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (!menuToggle || !navLinks) return;

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = menuToggle.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });

    // Close menu when clicking links (for better mobile UX)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
        });
    });
}

/**
 * Fade-in Animation on Scroll using Intersection Observer
 */
function initScrollAnimations() {
    const observerOptions = { 
        threshold: 0.05,
        rootMargin: '0px 0px 0px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
            }
        });
    }, observerOptions);

    // 1. Observe all elements with explicit data-aos attribute
    document.querySelectorAll('[data-aos]').forEach(el => {
        observer.observe(el);
    });

    // 2. Apply data-aos attribute dynamically to major layout elements if not present, then observe
    document.querySelectorAll('section, .grid, .card, .committee-card').forEach(el => {
        if (!el.hasAttribute('data-aos')) {
            el.setAttribute('data-aos', 'fade-up');
            observer.observe(el);
        }
    });
}

/**
 * FAQ Accordion Toggle
 */
function initFaqAccordion() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            
            // Toggle active state
            const isActive = item.classList.contains('active');
            
            // Close other open items (optional, but professional)
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

/*
Countdown For The main Event
*/
    // Set the date we're counting down to (Nov 19, 2026 at 09:00 AM)
    const countDownDate = new Date("Nov 19, 2026 09:00:00").getTime();

    // Update the countdown every 1 second
    const countdownFunction = setInterval(function() {

        // Get today's date and time
        const now = new Date().getTime();

        // Find the distance between now and the countdown date
        const distance = countDownDate - now;

        // Time calculations for days, hours, minutes, and seconds
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Display the result in the corresponding elements, padding with 0 if needed
        document.getElementById("days").innerText = days < 10 ? '0' + days : days;
        document.getElementById("hours").innerText = hours < 10 ? '0' + hours : hours;
        document.getElementById("minutes").innerText = minutes < 10 ? '0' + minutes : minutes;
        document.getElementById("seconds").innerText = seconds < 10 ? '0' + seconds : seconds;

        // If the countdown is over, clear the timer and display a styled banner
        if (distance < 0) {
            clearInterval(countdownFunction);
            document.getElementById("countdown").innerHTML = `
                <style>
                    @keyframes cfStartedPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(229, 180, 34, 0.4); }
                        50%       { box-shadow: 0 0 0 14px rgba(229, 180, 34, 0); }
                    }
                    @keyframes cfStartedFadeIn {
                        from { opacity: 0; transform: scale(0.9) translateY(10px); }
                        to   { opacity: 1; transform: scale(1) translateY(0); }
                    }
                </style>
                <div style="
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    background: rgba(229, 180, 34, 0.1);
                    border: 2px solid var(--accent, #E5B422);
                    border-radius: 16px;
                    padding: 28px 44px;
                    animation: cfStartedFadeIn 0.7s cubic-bezier(0.165, 0.84, 0.44, 1) forwards,
                               cfStartedPulse 2.5s ease-in-out 0.7s infinite;
                ">
                    <i class="fas fa-flag-checkered" style="font-size: 2rem; color: var(--accent, #E5B422);"></i>
                    <span style="
                        font-family: 'Montserrat', sans-serif;
                        font-size: 1.55rem;
                        font-weight: 900;
                        color: #ffffff;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        text-align: center;
                        line-height: 1.3;
                    ">IS&sup3;A&sup3; 2026 Is Now Underway!</span>
                    <span style="
                        font-size: 0.95rem;
                        color: var(--accent, #E5B422);
                        font-weight: 600;
                        letter-spacing: 0.5px;
                        text-align: center;
                        opacity: 0.9;
                    ">Nov 19–20, 2026 &nbsp;·&nbsp; Dept. of CSE, Tezpur University</span>
                </div>
            `;
        }
    }, 1000);