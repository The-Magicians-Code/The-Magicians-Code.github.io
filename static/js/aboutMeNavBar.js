function toggleMenu() {
    var { overlayNav, hamburgerBtn, body } = getElements();
    
    if (hamburgerBtn.classList.contains('is-active')) {
        close(overlayNav, hamburgerBtn, body);
    } else {
        overlayNav.classList.add('fullscreen')
        hamburgerBtn.classList.add('is-active');
        body.classList.add('fixed')
    }
}

function close(overlayNav, hamburgerBtn, body) {
    overlayNav.classList.remove('fullscreen');
    hamburgerBtn.classList.remove('is-active');
    body.classList.remove('fixed')

}

function getElements() {
    var overlayNav = document.getElementById("nav");
    var hamburgerBtn = document.querySelector('.hamburger-menu button');
    let body = document.getElementsByTagName('body')[0]
    return { overlayNav, hamburgerBtn, body };
}

// Function to close the overlay
function closeMenu() {
    var { overlayNav, hamburgerBtn, body } = getElements();
    close(overlayNav, hamburgerBtn, body);
}

// Event listener for window resize
window.addEventListener('resize', function() {
    // Close the overlay if it's open
    if (window.innerWidth > 768) { // Adjust the value as per your media query breakpoint
        closeMenu();
    }
});
