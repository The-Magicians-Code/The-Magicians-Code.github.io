function toggleMenu() {
    var overlayNav = document.getElementById("overlay-nav");
    var hamburgerBtn = document.querySelector('.hamburger-menu button');

    if (overlayNav.style.height === '100%') {
        overlayNav.style.height = '0%';
        hamburgerBtn.classList.remove('is-active');
    } else {
        overlayNav.style.height = '100%';
        hamburgerBtn.classList.add('is-active');
    }
}

// Function to close the overlay
function closeMenu() {
    var overlayNav = document.getElementById("overlay-nav");
    var hamburgerBtn = document.querySelector('.hamburger-menu button');
    overlayNav.style.height = '0%';
    hamburgerBtn.classList.remove('is-active');
}

// Event listener for window resize
window.addEventListener('resize', function() {
    // Close the overlay if it's open
    if (window.innerWidth > 768) { // Adjust the value as per your media query breakpoint
        closeMenu();
    }
});