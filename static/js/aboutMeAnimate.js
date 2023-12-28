document.addEventListener('DOMContentLoaded', function() {
    const animatedText = document.getElementById('animated-text');
    let degree = 0;

    function animateGradient() {
        setInterval(() => {
            degree = (degree + 1) % 360;
            animatedText.style.backgroundImage = `linear-gradient(${degree}deg, blue, red)`;
        }, 20); // Adjust the interval for speed
    }

    animateGradient();
});

document.getElementById('nav-dropdown').addEventListener('change', function() {
    window.location.href = this.value;
});