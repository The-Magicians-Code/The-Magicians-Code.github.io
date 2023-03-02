$(window).on("load", function(e) {
    var elements = ['content', 'loaded'];
    $(".content").html("Still indexing")//.fadeIn(1000)
    $(".loaded").attr("src", "static/light-mode.gif")//.fadeIn(1000)

    $(".chosen-select").chosen({
        no_results_text: "Oops, nothing found!",
        max_shown_results: "30",
        width: "100%",
    })

    function fadeInElement(elem, time) {      //Fade-in function that takes the element to fade-in, and the time it should wait
        setTimeout(function() {
            elem.fadeIn(1000);
        }, 1000 * time);                      //Set the time it should wait
    }

    for (let i = 0; i < elements.length; i++) {
        var thisElement = $("." + elements[i]); //Get the current element based on class
        fadeInElement(thisElement, i);          //Call our "Fade in" function
    }
    var count = 0;
    setInterval(function(){
        count++;
        $(".content").html("Still indexing" + new Array(count % 5).join('.'));
    }, 1000);
    // $(document.body).append("<div>hi</div>")
});

// $(window).resize(function () {
//     var width = $("#container")[0].offsetWidth + "px";
//     $("#container .chosen-container").css("width", width);
// });
$(window).resize(function () {
    if (screen.width <= 600) {
        $(".loaded").attr("src", "static/dark-mode.gif")
    } else {
        $(".loaded").attr("src", "static/light-mode.gif")
    }
})