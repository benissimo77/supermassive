document.addEventListener('DOMContentLoaded', function() {
    // Dynamic header (unchanged)
    const header = document.getElementById('main-header');
    let lastScrollTop = 0;

    gsap.to("#main-header", {
        backgroundColor: "rgba(26, 0, 51, 0.8)",
        backdropFilter: "blur(10px)",
        scrollTrigger: {
            start: "top+=800",
            end: "top+=1000",
            scrub: true
        }
    });


    // GSAP Animations
    gsap.registerPlugin(ScrollTrigger);

    // Hero section parallax effect
    gsap.to('#hero', {
        backgroundPosition: '50% 100%',
        ease: 'none',
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    // Game cards staggered animation
    gsap.from('.game-card', {
        scrollTrigger: {
            trigger: '#games',
            start: 'top 80%',
            end: 'center center',
            scrub: 1,
            toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 100,
        stagger: 0.2
    });

    // How it works steps animation
    gsap.from('.step', {
        scrollTrigger: {
            trigger: '#how-it-works',
            start: 'top 80%',
            end: 'center center',
            scrub: 1,
            toggleActions: 'play none none reverse'
        },
        opacity: 0,
        scale: 0.8,
        stagger: 0.2
    });

    // Testimonials animation
    gsap.from('.testimonial', {
        scrollTrigger: {
            trigger: '#testimonials',
            start: 'top 80%',
            end: 'center center',
            scrub: 1,
            toggleActions: 'play none none reverse'
        },
        opacity: 0,
        x: -100,
        stagger: 0.2
    });

    // Leaderboard section
    gsap.from('.leaderboard-list, .leaderboard-item', {
        scrollTrigger: {
            trigger: '#leaderboards',
            start: 'top 25%',
            end: 'center 50%',
            toggleActions: 'play none none reverse'
        },
        top: 300,
        stagger: 0.2
    });

    // Parallax effect for section backgrounds
    gsap.utils.toArray('.section-dark, .section-light').forEach((section) => {
        const parallaxBg = section.querySelector('.parallax-bg');
        gsap.fromTo(parallaxBg, {
            yPercent: -20
        }, {
            yPercent: 20,
            ease: "none",
            scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "bottom top",
                scrub: true
            }
        });
    });

    // Wave divider animations
    const waves = [
        { element: ".wave1", duration: 27 },
        { element: ".wave2", duration: 19 },
        { element: ".wave3", duration: 13 },
        { element: ".wave4", duration: 9 },
        { element: ".wave5", duration: 5 }
    ];

    waves.forEach((wave, index) => {
        console.log(wave);
        console.log(document.querySelector(wave.element));
        const { startX, endX } = index % 2 === 0 ? { startX: -50, endX: 0 } : { startX: 0, endX: -50 };
        const waveAnimation = gsap.fromTo(wave.element,
            {
                xPercent: startX,            // Starting point of the animation range
            },
            {
                xPercent: endX,            // End point of the animation range
                duration: wave.duration,
                ease: "linear",
                yoyo: false,
                repeat: -1
            }
        );
        waveAnimation.seek(Math.random() * wave.duration);

    });

});


