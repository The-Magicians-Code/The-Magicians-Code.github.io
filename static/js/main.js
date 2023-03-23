$(window).on("load", function(e) {
    var elements = ['s-content', 's-0', 's-1', 's-loaded'];
    $(".s-content").html("Still indexing")//.fadeIn(1000)
    $(".s-loaded").attr("src", "static/light-mode.gif")//.fadeIn(1000)

    $(".chosen-select").chosen({
        no_results_text: "Oops, nothing found!",
        max_shown_results: "30",
        width: "100%",
    })

    function showElement(elem, time) {
        setTimeout(() => {
            elem.css("visibility", "visible").hide().fadeIn(1000)
        }, 1000 * time);
    }
    for (let i = 0; i < elements.length; i++) {
        var thisElement = $("." + elements[i]);
        showElement(thisElement, i);
    }

    var count = 1;
    setInterval(function() {
        count++;
        $(".s-content").html("Still indexing" + new Array(count % 5).join('.'));
    }, 1000);
});

$(document).ready(function() {
    $(document).on('change', '#queryform', function(e) {
        // This function grabs data from form and sends it to Flask
        e.preventDefault(); // Prevent refresh
        form = $(this).serialize() // Converts form data to URL query form
        // console.log(`${document.location.origin}?${form}`)
        console.log(form)
    });
});