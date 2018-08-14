"use strict"


/// TODO: Seting language corpus should be at a higher level. The
/// callback should both update the Corpus object and tell
/// the wordlists to update their colours
/// 

;(function (lx){

  /* POLYFILLS and HACKS */
    // http://stackoverflow.com/a/4314050/1927589
    if (!String.prototype.splice) {
      /**
       * The splice() method changes the content of a string by
       * removing a range of characters and/or adding new characters.
       *
       * @this {String}
       * @param {number} start Index at which to start changing the string.
       * @param {number} delCount An integer indicating the number of old chars to remove.
       * @param {string} newSubStr The String that is spliced in.
       * @return {string} A new string with the spliced substring.
       */
      String.prototype.splice = function(
        start = 0
      , delCount = 0
      , newSubStr = "") {
        return this.slice(0, start)
             + newSubStr
             + this.slice(start + Math.abs(delCount))
      }
    }

    if (!String.prototype.toCamelCase) {
      String.prototype.toCamelCase = function() {
        return this.replace(/-([a-z])/g, replaceMethod)

        function replaceMethod(hyphenAndLetter) {
          return hyphenAndLetter[1].toUpperCase()
        }
      }
    }
  /* END POLYFILLS */



  class Corpus {
    constructor(minTarget) {
      this.minTarget = minTarget

      this.ordered = []
      this.acceptable = []
      this.outOfRange = []

      // <<<HARD-CODED
      this.redMin = 102 // #600
      // HARD-CODED >>>

      this.target = this.minTarget
    }


    setCorpus(corpusData) {
      this.ordered = corpusData
      // this.updateRangeLists() will be called by setTarget()
    }


    setTarget(target) {
      if (isNaN(target) || target < this.minTarget) {
        return false
      }

      target = this.target = Math.min(target, this.ordered.length / 2)
      this.updateRangeLists()

      return target
    }


    getTarget() {
      return this.target
    }


    getWordCount() {
      return this.ordered.length
    }


    updateRangeLists() {
      this.acceptable = this.ordered.slice(0, this.target * 2)
      this.acceptable.sort()

      this.outOfRange = this.ordered.slice(this.target * 2)
      this.outOfRange.sort()
    }


    /**
     * Returns -1 for words not in this.orderedList, or a positive
     * integer
     */
    getFrequency(word) {
      return this.ordered.indexOf(word) // .toLowerCase())
    }


    /**
     * HACK: This method directly affects an HTML element which
     * belongs to a WordList instance.
     *
     * @param      {<type>}  listName     "acceptable" || "outOfRange"
     * @param      {<type>}  listElement  a <ul> element
     */
    setListItems(listName, listElement) {
      let list = this[listName]
      let total = list.length
      let ii
        , word
        , li
        , colour

      while (listElement.hasChildNodes()) {
        listElement.removeChild(listElement.lastChild);
      } 
      
      for (ii = 0; ii < total; ii += 1) {
        word = list[ii]
        colour = this.getWordColour(word)
        li = document.createElement("li")
        li.appendChild(document.createTextNode(word))
        li.style.color = colour

        listElement.appendChild(li)
      }
    }


    /**
     * Returns a colour which is either black, a shade of red
     * (depending on how far outside the target range the index
     * is) or purple if the index is not in 
     *
     * @param      {number}  index   The index
     */
    getColour(index) {
      let red

      if (index < 0) {
        // index = this.ordered.length
        red = "#c0f"
      } else if (index > this.target * 2) {
        red = "#f0c" // actually purple

      } else if (index < this.target) {
        red = "#000" // black

      } else {
        red = index - this.target // maximum = target
        red = Math.floor(red * (255 - this.redMin) / this.target)
            + this.redMin
        red = red < 16 ? "0" + red.toString(16)
                       : red.toString(16)
        red = "#" + red + "0000"
      }

      return red
    }


    getWordColour(word) {
      let index = this.ordered.indexOf(word.toLowerCase())
      let colour = this.getColour(index)

      return colour
    }
  }



  /**
   * Assumes that the HTML page contains (un)ordered lists with the
   * ids "ordered", "acceptable", and "out-of-range"
   *
   * @class      Panels (name)
   */
  class Panels {
    constructor(corpus, elementIds) {
      this.corpus = corpus
      this.createlists(elementIds)
      // creates;
      // * this.ordered
      // * this.acceptable
      // * this.outOfRange
    }


    createlists(elementIds) {
      let options = {
        id: elementIds.ordered
      , type: "ol"
      , corpus: this.corpus
      }

      this.ordered = new WordList(options)

      options.id = elementIds.acceptable
      options.type = "ul"
      this.acceptable = new AlphabeticalList(options)

      options.id = elementIds.outOfRange
      this.outOfRange = new AlphabeticalList(options)
    }


    setTarget(value) {
      this.ordered.updateList()
      this.acceptable.updateList()    
      this.outOfRange.updateList()
    }


    scrollTo(word) {
      this.acceptable.scrollTo(word)
      this.outOfRange.scrollTo(word)
      this.ordered.scrollTo(word)
    }
  }



  class WordList {
    constructor(options) {
      this.corpus = options.corpus

      let selector = "#" + options.id + " " + options.type
      this.element = document.querySelector(selector)
      this.name = options.id.toCamelCase()

      this.highLitLi = null
    }


    updateList(ignoreHack) {
      this.corpus.setListItems(this.name, this.element)

      // HACK to indicate how many words are in the ordered list
      if (!ignoreHack) {
        let p = this.element.parentNode.querySelector("p")
        if (p) {
          let count = this.corpus.getWordCount()
          p.innerText = "Corpus: " + count.toLocaleString() + " words"
        }
      }
    }


    scrollTo(word) {
      let index = this.corpus.getFrequency(word)
      let success = this._scrollToIndex(index)

      if (!success) {
        // Try a case-insensitive match
        index = this.corpus.getFrequency(word.toLowerCase())
        this._scrollToIndex(index)
      }
    }


    _scrollToIndex(index) {     
      if (index < 0) {
        // No such word: we can't scroll to it.
        // TO DO: Show an alert in the toolbar?
        return false
      }
      
      if (this.highLitLi) {
        this.highLitLi.classList.remove("highlight")
      }
      this.highLitLi = this.element.children[index]

      this._scrollIntoView(this.highLitLi)

      return true
    } 


    _scrollIntoView(node) {
      var rect = node.getBoundingClientRect()
      var top  = rect.top
      var bottom = rect.bottom

      var parentNode = node.parentNode
      var parentRect = parentNode.getBoundingClientRect()
      var topAdjust = parentRect.top - top
      var adjust = parentRect.bottom - bottom

      if (topAdjust > 0) {
        adjust = topAdjust

      } else if (adjust < 0) {
        adjust = Math.max(adjust, topAdjust)
      }
      
      parentNode.scrollTop -= adjust

      node.classList.add("highlight")
    }
  }


  class AlphabeticalList extends WordList {
    updateList() {
      super.updateList(true)

      let getInnerText = (element) => {
        return element.innerText.toLowerCase()
      }
      let children = [].slice.apply(this.element.children) // li elements

      this.alphabeticalArray = children.map(getInnerText)
    }


    scrollTo(word) {
      let index = this.alphabeticalArray.indexOf(word)
      let success = this._scrollToIndex(index)

      if (!success) {
        // Try a case-insensitive match
        index = this.alphabeticalArray.indexOf(word.toLowerCase())
        this._scrollToIndex(index)
      }
    } 
  }

  /* TESTS */
      // ;(function TESTS(){

      //   // test_getInsertionContext()
      //   // test_emptyContext()

      //   /* For each of w, W, r and delete (44 tests)
      //    * 
      //    * start of text
      //    * end of text
      //    * boundary w + W
      //    * boundary w + r
      //    * boundary W + w
      //    * boundary r + w
      //    * boundary W + r
      //    * boundary r + W
      //    * middle of w
      //    * middle of W
      //    * middle of r
      //    */
        
      //   // Deal with PASTED text
      //   // 
      //   // Check input when ENTER is pressed
      //   // 
      //   // Check BACKSPACE and DELETE (treate as single char selections)
      //   // 
      //   // Check arrow keys, shift, insert and other non-printing characters

      //   function test_emptyContext(){
      //     var cr = "\n"
      //     textMap = { 
      //        0: 0
      //     }

      //     this.wordBorderArray = [0]

      //     console.log(0)
      //     console.log(getInsertionContext(0))
      //     console.log(getInsertionContext(0, true))
      //   }

      //   function test_getInsertionContext(){
      //     var cr = "\n"
      //     textMap = { 
      //        0: "abc"
      //     ,  3: "!?"
      //     ,  5: cr + cr
      //     ,  7: "def"
      //     , 10: "."
      //     , 11: 0
      //     }
      //     this.wordBorderArray = [0, 3, 5, 7, 10, 11]

      //     // console.log(0)
      //     // console.log(getInsertionContext(0))
      //     // console.log(getInsertionContext(0, true))
      //     // console.log(1)
      //     // console.log(getInsertionContext(1))
      //     // console.log(getInsertionContext(1, true))
      //     // console.log(3)
      //     // console.log(getInsertionContext(3))
      //     // console.log(getInsertionContext(3, true))
      //     // console.log(4)
      //     // console.log(getInsertionContext(4))
      //     // console.log(getInsertionContext(4, true))
      //     // console.log(5)
      //     // console.log(getInsertionContext(5))
      //     // console.log(getInsertionContext(5, true))
      //     // console.log(6)
      //     // console.log(getInsertionContext(6))
      //     // console.log(getInsertionContext(6, true))
      //     // console.log(7)
      //     // console.log(getInsertionContext(7))
      //     // console.log(getInsertionContext(7, true))
      //     // console.log(9)
      //     // console.log(getInsertionContext(9))
      //     // console.log(getInsertionContext(9, true))
      //     // console.log(10)
      //     // console.log(getInsertionContext(10))
      //     // console.log(getInsertionContext(10, true))
      //     // console.log(11)
      //     // console.log(getInsertionContext(11))
      //     // console.log(getInsertionContext(11, true))       
      //   }
      // })()
  /* END OF TESTS */



  class GradedWriter {
    constructor(CorpusSource, InputManager, undoRedo) {
      let defaults = localStorage.getItem("graded-writer")
                  || { languageCode: "ru", target: 500 }
      let minTarget = 250

      // <<< HARD-CODED ids of HTML elements 
      let elementIdMap = {
        acceptable: "acceptable"
      , outOfRange: "out-of-range"
      , ordered:    "ordered"
      , textArea:   "textArea"
      , overlay:    "overlay"
      }
      // HARD-CODED >>>

      // The Corpus Select and Target elements needs to inform the
      // Corpus, InputManager and Panels instances
      // that the display is to change, so they need to be controlled
      // at this highest level. However, initialization can not
      // complete until we have corpus data

      this.shiftDown = this.initializeShiftDetector()

      this.initializeTarget(defaults.target, minTarget)

      let corpus = this.corpus = new Corpus(minTarget)

      let panels = this.panels = new Panels( corpus
                                           , elementIdMap
                                           )
      // The inputManager needs to be able to call this.scrollTo
      // when the insertion point moves into or out of a word.
      this.inputManager = new InputManager( corpus
                                          , undoRedo
                                          , panels
                                          )

      let callback = this.callbackWith.bind(this)
      this.corpusSource = new CorpusSource(callback)
      this.corpusSource.getWordList(defaults.languageCode)
    }


    initializeShiftDetector() {
      // Hack to check when user is pressing Shift while dragging slider
      let checkShift = (event) => {
        this.shiftDown = event.shiftKey
      }

      document.addEventListener('keydown', checkShift, false)
      document.addEventListener('keyup', checkShift, false)

      return false // initial value of this.shiftDown
    }


    initializeTarget(defaultTarget, minTarget) {
      // <<< HARD-CODED
      let rangeSelector = "#target input[type=range]"
      let fieldSelector = "#target input[type=text]" 
      this.step = 250
      this.shiftStep = 50
      // HARD-CODED >>>

      this.target = defaultTarget
      this.targetRange = document.querySelector(rangeSelector)
      this.targetRange.max = defaultTarget
      this.targetRange.value = defaultTarget
      this.targetRange.min = minTarget

      this.targetField = document.querySelector(fieldSelector)
      this.targetField.value = defaultTarget

      this.targetRange.oninput = (event) => {
        let step = this.shiftDown ? this.shiftStep : this.step

        let value = this.targetRange.value
        value = Math.floor(value / step) * step

        this.targetField.value = value
        this.targetRange.value = value
      }

      this.targetRange.onchange = (event) => {
        let value = event.target.value
        this.setTarget(value)
      }
    }


    setTarget(value, ignoreChange) {
      let target = this.corpus.setTarget(value)
      if (!target) {
        this.setTarget(this.target, true)
        return console.log("Target value could not be set:", value)
      }

      this.targetRange.value = target
      this.targetField.value = target

      if (!ignoreChange) {
        this.inputManager.setTarget(target)
        this.panels.setTarget(target)
        this.target = target
      }
    }


    callbackWith(languageData) {
      if ( !languageData
        || typeof languageData !== "object"
        || !Array.isArray(languageData.corpus)) {

        return console.log("Array expected in languageData"
                          , languageData)
      }

      this.corpus.setCorpus(languageData.corpus)
      this.inputManager.setWordDetection( languageData.regex
                                        , languageData.findWords
                                        )

      this.targetRange.max = languageData.corpus.length / 2
      this.setTarget(this.target)

      //this.inputManager.load("Мне было тогда лет двадцать пять, — начал Н.Н. — давно это было. Я уехал за границу, я хотел посмотреть на мир.\n\nЯ был здоров, молод, весел, деньги у меня были — я делал, что хотел.")
      this.inputManager.load("Я хотел посмотреть на мир.\n\nЯ был здоров — я делал, что хотел.")
    }
  }


  lx.gradedWriter = new GradedWriter(
    lx.CorpusSource
  , lx.InputManager
  , lx.undoRedo
  )


})(window.lexogram)