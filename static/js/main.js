/**
  * Dynamically add (or remove) a "Deselect All" pseudo-option
  */

function slimSelectDeselectAll(info) {
    var curData = this.data.data;
    var selected_count = info.length;
    var has_deselect_button = curData.filter(v => v.value === '' || v.value === 'Deselect all').length > 0;
    var wants_deselect = this.selected().includes("Deselect all") || this.selected().includes("");
 
    if (wants_deselect) {
       this.set([]);
       this.setData(curData.filter(v => v.value !== '' && v.value !== 'Deselect all' ));
       return;
    }
 
    if (selected_count && !has_deselect_button) {
       curData.unshift({value: "", text: "Deselect all"});
       this.setData(curData);
    }
}

function paramsToObject(entries) {
    const result = {}
    var values = []
    var multiples = "action"
    for (const [key, value] of entries) { // each 'entry' is a [key, value] tupple
        if (key === multiples) {
            values.push(value)
        } else {
            result[key] = value;
        }            
    }
    result[multiples] = values
    return result;
}

function validate_URL() {
    console.log("Nice!")
}

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
    // console.log(paramsToObject(params))
    
    // var actions = params.getAll("action")
    // var subject = params.get("subject")
    
    // query_params = {
    //     "action": actions.length > 0 ? actions : ["1", "2"],
    //     "subject": subject ? subject : ["4"]
    // }
    // console.log(query_params)
    query_params = {}
    var found = document.getElementsByClassName("s2a")
    var elements = []
    for (var i = 0; i < found.length; i++) {
        elements.push(found[i].className.split(" ")[1])
    }
    $(".content").html("Still indexing")

    action_selector = new SlimSelect({
        select: "#itemdrop-0",
        events: {
            afterChange: () => {
                customURL()
            }
        },
        settings: {
            placeholderText: "Your turn",
            allowDeselect: true
        }
    })

    subject_selector = new SlimSelect({
        select: "#itemdrop-1",
        events: {
            afterChange: () => {
                console.log(subject_selector.getSelected())
                customURL()
            }
        },
    })
    // action_selector.setSelected(query_params["actions"])
    // subject_selector.setSelected(query_params["subject"])
    action_selector.setSelected(params.getAll("action"))
    subject_selector.setSelected(params.get("subject"))

    chosen = $(".chosen-select")
    chosen.val(params.getAll("items"))
    chosen.trigger("chosen:updated")

    var btn = document.getElementById('clippy');
    var clipboard = new ClipboardJS(btn);

    clipboard.on('success', function (e) {
        console.info('Action:', e.action);
        console.info('Text:', e.text);
        console.info('Trigger:', e.trigger);
    });

    clipboard.on('error', function (e) {
        console.info('Action:', e.action);
        console.info('Text:', e.text);
        console.info('Trigger:', e.trigger);
    });


    customURL()

    // Creates custom dropdowns
    $(".chosen-select").chosen({
        no_results_text: "Oops, nothing found!",
        max_shown_results: "30",
        width: "100%"
    })

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

    var count = 1;
    setInterval(function() {
        count++;
        $(".content").html("Still indexing" + new Array(count % 5).join('.'));
    }, 1000);

    function customURL() {
        query_params["action"] = action_selector.getSelected()
        query_params["subject"] = subject_selector.getSelected()

        const p = new URLSearchParams();
        for (var i = 0; i < query_params["action"].length; i++) {
            p.append("action", query_params["action"][i]);
        }
        p.append("subject", query_params["subject"])

        var new_url = new URL(`${url.origin}${url.pathname}?${p}`)
        $(".page_link").text(new_url)
    }
    // console.log(query_params)
});

$(document).ready(function() {
    // console.log(query_params)
    $(".aabtn").click(function() {
        action_selector.setSelected([])
        // action_selector.search("Open")
        $(".chosen-select").val("")
        $(".chosen-select").trigger("chosen:updated")
    })

    $(".chosen-select").on("change", function() {
        var chosen = $(this);
        // var initialised_elements = chosen.find(":selected").text()
        // console.log(initialised_elements)
        console.log(chosen.val()) //Print out initialised values
    }) 

    // $('select.chart_type').each(function() {    
    //     var chosen = $(this);
    //     var initialised_elements = chosen.find(":selected").text()
  
    //     if (!initialised_elements.includes(buttondata.chart_type)) {
    //         chosen.val(buttondata.chart_type);
    //         chosen.trigger('chosen:updated');
    //     }
    // });
});