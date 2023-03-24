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

var animationtime = 0 // milliseconds
$(window).on("load", function(e) {
    url = window.location
    params = paramsToObject(new URLSearchParams(url.search).entries())
    console.log(params)

    var elements = ['s2a-content', 's2a-0', 's2a-1', 's2a-loaded', 's2a-aabtn'];
    $(".s2a-content").html("Still indexing")
    $(".s2a-loaded").attr("src", "static/light-mode.gif")

    // $(".chosen-select").chosen({
    //     no_results_text: "Oops, nothing found!",
    //     max_shown_results: "30",
    //     width: "100%",
    // })

    action_selector = new SlimSelect({
        select: "#itemdrop-0",
        events: {
            afterChange: () => {
                console.log(action_selector.getSelected())
            }
        },
        settings: {
            placeholderText: "Your turn"
        }
    })

    new SlimSelect({
        select: "#itemdrop-1",
        events: {
            afterChange: (newVal) => {
                console.log(newVal[0])
            }
        },
    })

    action_selector.setSelected(params["action"])

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
        $(".s2a-content").html("Still indexing" + new Array(count % 5).join('.'));
    }, 1000);
});

$(document).ready(function() {
    // $(document).on('change', '#queryform', function(e) {
    //     // This function grabs data from form and sends it to Flask
    //     e.preventDefault(); // Prevent refresh
    //     form = $(this).serialize() // Converts form data to URL query form
    //     // console.log(`${document.location.origin}?${form}`)
    //     console.log(form)
    // });
    
    $(".s2a-aabtn").click(function() {
        action_selector.setSelected([])
        // action_selector.search("Open")
    })
});