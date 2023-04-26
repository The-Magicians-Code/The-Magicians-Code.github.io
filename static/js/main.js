function darkmode(isdark=true) {
    if (isdark) {
        $(".loaded").attr("src", "static/dark-mode.gif")
        $("select").css("background", "black")
    } else {
        $(".loaded").attr("src", "static/light-mode.gif")
        $("select").css("background", "white")
    }
}

var animationtime = 500 // milliseconds
$(window).on("load", function(e) {
    url = window.location
    params = new URLSearchParams(url.search)
    
    // var actions = params.getAll("action")
    // var subject = params.get("subject")
    
    // query_params = {
    //     "action": actions.length > 0 ? actions : ["1", "2"],
    //     "subject": subject ? subject : ["4"]
    // }
    // console.log(query_params)
    query_params = {}
    // Find all elements that need to be hidden
    var found = document.getElementsByClassName("s2a")
    var elements = []
    for (var i = 0; i < found.length; i++) {
        elements.push(found[i].className.split(" ")[1])
    }
    // Initialise object data
    $(".content").html("Still indexing")
    $(".clipimg").attr("src", "static/copyit.png")

    // Initialise Slim and Chosen selectors
    action_selector = new SlimSelect({
        select: "#itemdrop-0",
        events: {
            afterChange: () => {
                customURL()
            }
        },
        settings: {
            placeholderText: "Your turn",
        }
    })

    subject_selector = new SlimSelect({
        select: "#itemdrop-1",
        events: {
            afterChange: () => {
                customURL()
            }
        },
    })

    chosen = $(".chosen-select")
    chosen.chosen({
        no_results_text: "Oops, nothing found!",
        max_shown_results: "30",
        width: "100%"
    })

    // Set Slim selector values color to black
    var ssMain = $(".ss-main");
    var ssValues = ssMain.find('.ss-values');
    ssValues.bind("DOMNodeInserted", function () {
        ssValues.find("div").each(function() {
            if (this.className == "ss-value")
            $(this).css('background-color', 'black');
        });
    });

    // Initialise Slim and Chosen selectors with URL parameters
    action_selector.setSelected(params.getAll("action"))
    subject_selector.setSelected(params.get("subject"))

    chosen.val(params.getAll("items")) // Set Chosen dropdown value
    chosen.trigger("chosen:updated")

    // Set Chosen selector event listener
    chosen.on("change", function() {
        console.log(chosen.val())
        customURL()
    })

    // Initialise clipboard element
    var btn = document.getElementById('clippy');
    var clipboard = new ClipboardJS(btn);
    clipboard.on('success', function (e) {
        $(".clipimg").attr("src", "static/copydone.png")
        setTimeout(function() {
            $(".clipimg").attr("src", "static/copyit.png")
        }, 1000)
    });

    // Create a URL instance when no interaction from the user
    customURL()

    // const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    // if (prefersDarkScheme.matches) {
    //     document.body.classList.add("dark-theme");
    //     darkmode()
    // } else {
    //     document.body.classList.remove("dark-theme");
    //     darkmode(false)
    // }
    darkmode(false)
    function showElement(elem, time) {
        setTimeout(() => {
            elem.css("visibility", "visible").hide().fadeIn(animationtime)
        }, animationtime * time);
    }
    for (let i = 0; i < elements.length; i++) {
        var thisElement = $("." + elements[i]);
        showElement(thisElement, i);
    }

    // Display loading dots
    var count = 1;
    setInterval(function() {
        count++;
        $(".content").html("Still indexing" + new Array(count % 5).join('.'));
    }, 1000);

    // Custom URL constructor
    function customURL() {
        // Set query parameters dict data
        query_params["action"] = action_selector.getSelected()
        query_params["subject"] = subject_selector.getSelected()
        query_params["items"] = chosen.val().length > 0 ? chosen.val() : []

        // Initialise URL constructor
        const p = new URLSearchParams();
        // Append data to it, works with keys have single and multiple values
        multikeys = Object.keys(query_params)
        for (var index = 0; index < multikeys.length; index++) {
            var key = multikeys[index]
            for (var i = 0; i < query_params[key].length; i++) {
                p.append(key, query_params[key][i]);
            }
        }

        // Construct URL and update the respective element
        var new_url = new URL(`${url.origin}${url.pathname}?${p}`)
        $(".page_link").text(new_url)
    }
    console.log(query_params)

    $(".aabtn").click(function() {
        action_selector.setSelected([])
        subject_selector.setSelected([])
        // action_selector.search("Open")
        chosen.val("")
        chosen.trigger("chosen:updated")
        customURL()
    })
});