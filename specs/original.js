"use strict"


/// TODO: Seting language corpus should be at a higher level. The
/// callback should both update the Corpus object and tell
/// the wordlists to update their colours
/// 

;(function (lx){

  var overlayNodes = []
  var highLitLi = 0

  // Regex
  var _rn = /[\r|\r\n|\n]/ // line break on any platform
  var _W = /[\s!-\/:-@[-`{-~\u00A0-¾—-⁊$]/ // any non-word character

  /* POLYFILLS and HACKS */
    // http://stackoverflow.com/a/4314050/1927589
    if (!String.prototype.splice) {
      /**
       * {JSDoc}
       *
       * The splice() method changes the content of a string by
       * removing a range of characters and/or adding new characters.
       *
       * @this {String}
       * @param {number} start Index at which to start changing the string.
       * @param {number} delCount An integer indicating the number of old chars to remove.
       * @param {string} newSubStr The String that is spliced in.
       * @return {string} A new string with the spliced substring.
       */
      String.prototype.splice = function(start, delCount, newSubStr) {
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
    constructor(options) {
      this.ordered = []
      this.acceptable = []
      this.outOfRange = []

      // <<<HARD-CODED
      this.redMin = 102 // #600
      this.minTarget = 500
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
        index = this.ordered.length
      }

      if (index > this.target * 2) {
        red = "#f09" // actually purple

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
      let index = this.ordered.indexOf(word)
      let colour = this.getColour(index)

      return colour
    }
  }



  /**
   * Assumes that the HTML page contains (un)ordered lists with the
   * ids "ordered", "acceptable", and "out-of-range"
   *
   * @class      ControlPanels (name)
   */
  class ControlPanels {
    constructor(corpus, inputManager, elementIds) {
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
      this.acceptable = new WordList(options)

      options.id = elementIds.outOfRange
      this.outOfRange = new WordList(options)
    }


    setTarget(value) {
      this.ordered.updateList()
      this.acceptable.updateList()    
      this.outOfRange.updateList()
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


    updateList() {
      this.corpus.setListItems(this.name, this.element)

      // HACK to indicate how many words are in the ordered list
      if (this.name === "ordered") {
        let p = this.element.parentNode.querySelector("p")
        if (p) {
          let count = this.corpus.getWordCount()
          p.innerText = "Corpus: " + count.toLocaleString() + " words"
        }
      }
    }


    scrollTo(word) {
      let frequencyIndex = this.corpus.getFrequency(word)
      
      if (frequencyIndex < 0) {
        // No such word: we can't scroll to it.
        // TO DO: Show an alert in the toolbar?
        return
      }
      
      if (highLitLi) {
        highLitLi.classList.remove("highlight")
      }
      highLitLi = ol.children[frequencyIndex]

      scrollIntoView(highLitLi)
    } 


    scrollIntoView(node) {
      var rect = node.getBoundingClientRect()
      var top  = rect.top
      var bottom = rect.bottom

      var parentNode = node.parentNode
      var parentRect = parentNode.getBoundingClientRect()
      var topAdjust = parentRect.top - top
      var adjust = parentRect.bottom - bottom

      if (topAdjust > 0) {
        adjust = topAdjust
        parentNode.scrollTop -= adjust

      } else if (adjust < 0) {
        adjust = Math.max(adjust, topAdjust)
        parentNode.scrollTop -= adjust
      }

      highLitLi.classList.add("highlight")
    }
  }



  class InputManager {
    constructor(corpus) {
      this.corpus = corpus

      // <<< HARD-CODED
      let inputSelector = "#input textarea"
      let overlaySelector = "#input p"
      // HARD-CODED >>>

      this.input = document.querySelector(inputSelector)
      this.overlay = document.querySelector(overlaySelector)
      this.overlayNodes = []

      // this.regex
      // this.findWords
                                                // 
      this.textMap = {0: ""}
      this.wordBorderArray = [0] 
      this.oldLength = 0   

      this.activeWordIndex = -1
      this.inputContext = {}
      
      // Key and mouse events
      let listener = this.treatKeyUp.bind(this)
      this.input.addEventListener("keyup", listener, true)
      listener = this.updateInputContext.bind(this)
      this.input.addEventListener("mouseup", listener, true)
    }


    setWordDetection(regex, findWords) {
      this.regex = new RegExp(regex)
      this.findWords = findWords

      this.updateInputContext()
    }


    setTarget() {
      let colorItem = (colour, node) => {
        node.style = "color:"+colour+";"
      }

      let total = overlayNodes.length
      let ii
        , node
        , text
        , index
        , colour
      
      for (ii = 0; ii < total; ii += 1) {
        node = overlayNodes[ii]
        text = node.textContent

        if (text.match(notWordRegex)) {
          // Ignore spaces and punctuation
        } else {
          index = this.corpus.getFrequency(text)

          if (index < 0) {
            // This may be a non-word, a <br> or an unknown word
          } else {
            colour = this.corpus.getColour(index)
            colourItem(colour, node)
          }
        }
      }
    }
 

    updateInputContext(event) {
      var before = this.getInsertionContext(input.selectionStart)
      var after  = this.getInsertionContext(input.selectionEnd, true)
      // We don't want the frequency list to scroll if the user is
      // simply starting a new word
      var isKeyInput = event
                    && event.type === "keyup" 
                    && event.key.length === 1

      this.inputContext = {
        before: before
      , after:  after
      , selectCount: input.selectionEnd - input.selectionStart
      } 

      this.refreshDisplay(isKeyInput)
    }
    /**
     * Gets the insertion context, either for the text preceding
     * charIndex (if isAfter is falsy), or for the text following.
     * 
     * If there is a selection, the contents of the selection will
     * need to be deleted before the new character is inserted.
     * 
     * When a character is inserted, it might be:
     * - within a word, a non-word sequence, or a series of linebreaks
     * - at a boundary between two types, one of which may be similar
     * 
     * In the first case, if the input is the same, it will be used to
     * join the preceding and following 
     * 
     * The `type`s for before and after will be compared with the
     * type of the current input. If all are the same, then the input
     * will become part of a single tag. If the input type is the same
     * as one of the surrounding types, it will be added to that
     * tag. If it is different from both, then a new tag will be
     * created.
     *
     * @param  {number}   charIndex  The position of the character
     *                                  in the textarea.textContent
     * @param  {boolean}  isAfter    True if the details of the
     *                                  following context should be
     *                                  returned. If not, the details
     *                                  of the preceding context will
     *                                  be returned
     * @return { index: charIndex
     *         , node: index of node
     *         , char: index of char within node
     *         , type: "w" | "W" | "r" (word | non-word | linebreak)
     *         }
     */
    getInsertionContext (charIndex, isAfter) {
      var context = { index: charIndex }

      var nodeIndex = this.wordBorderArray.length - 1
      var nodeStartChar = this.wordBorderArray[nodeIndex]
      var char
        , text

      if (!charIndex) { 
        if (!isAfter) {
          // We're right at the beginning: nothing before
          context.type = "^"
          context.node = -1
          return context
        }
      }

      while (nodeStartChar > charIndex) {
        nodeIndex -= 1
        nodeStartChar = this.wordBorderArray[nodeIndex]
      }

      char = charIndex - nodeStartChar

      context.node = nodeIndex
      context.char = char
      text = this.textMap[this.wordBorderArray[nodeIndex]]

      if (!isAfter) {
        if (!char) {
          // Special case: insertion point is at type boundary
          context.node = nodeIndex - 1
          text = this.textMap[this.wordBorderArray[nodeIndex - 1]]
          context.char = text.length
        }
      }

      context.type = getType(text)

      return context

      function getType(text) {
        if (!text) {
          return "$"
        } else if (_rn.test(text)) {
          return "r"
        } else if (_W.test(text)) {
          return "W"
        } else {
          return "w"
        }
      }
    }


    treatKeyUp(event) {
      postProcessKeyUp()
      updateInputContext(event)

      function postProcessKeyUp() {
        var key = event.key  
        var ignore = false
        var caret
          , text
          , newLength
          , type

        type = (function setType() {
          switch (event.keyCode) {
            case 13:
              key = String.fromCharCode(13) // was "Enter"
              return "r"
            case 8:
              return "b"
            case 46:
              return "d"
          }

          if (key.length !== 1 // may be "Control" or "Shift"
              || event.altKey
              || event.ctrlKey
              || event.metaKey) {

            return false
          }

          return _W.test(key)
          ? "W"
          : "w"
        })() // "w(ord)"|"W"|"r(eturn)"|"b(ackspace)"|"d"|false     
         
        if (!type) {   
          return
        }

        caret = input.selectionStart // after keyup === selectionEnd
        text = input.value
        newLength = text.length

        if (newLength === oldLength && this.inputContext.selectCount !== 1) {
          overwrite()
        } else {
          insert()
        }

        function overwrite() {
          alert ("Please don't use the overwrite feature yet")
        }

        function insert() {
          oldLength = newLength

          if (this.inputContext.selectCount) {
            deleteSelection()
          }

          if (type === "b") {
            // BACKSPACE
          } else if (type === "d") {
            // DELETE
          } else {
            treatInput()
          }
        }

        function deleteSelection() {
          alert ("Please don't test selection yet")
          // Remove intervening nodes
          // Trim end of start node
          // Trim start of end node
          // EITHER combine two nodes OR leave nodes as is
          // Update this.textMap
          // Update this.wordBorderArray
        }


        function treatInput() {
          if (type === this.inputContext.before.type) {
            // We may be extending a sequence or inserting in the
            // middle of it
            updateTag(this.inputContext.before, key, type)

          } else if (type === this.inputContext.after.type) {
            // We are prefixing a sequence
            updateTag(this.inputContext.after, key, type)

          } else {
            insertNewTag(type, key)
          }
        }

        // Colour word(s) if switching to non-word
      }
    }

    
    insertNewTag(tagType, text) {
      var tag
        , nodeIndex

      if (tagType === "r") {
        tag = document.createElement("br")

      } else {
        tag = document.createElement("span")
        tag.appendChild(document.createTextNode(text))
      }

      nodeIndex = this.inputContext.after.node
      if (oldLength && nodeIndex === this.inputContext.before.node) {
        splitNode(this.inputContext.before.char)
      }

      overlay.insertBefore(tag, overlay.childNodes[nodeIndex])
      overlayNodes.splice(nodeIndex, 0, tag)

      adjustTextMap(nodeIndex, text, text.length, 0)

      /**
       * Splits the node at nodeIndex at charIndex. The existing node
       * keeps the end of the text and a new node with the start of
       * the text is inserted before it. The following are updated:
       * - textMap
       * - wordBorderArray
       * - overlayNode
       * - nodeIndex
       *
       * @param  {number}  charIndex  character index where node is
       *                              to be split.
       */
      function splitNode(charIndex) {
        var key = this.wordBorderArray[nodeIndex]
        var text = this.textMap[key]
        var split = text.substring(charIndex)
        var text = text.substring(0, charIndex)
        var node = overlayNodes[nodeIndex]
        var tag = document.createElement("span")
        tag.appendChild(document.createTextNode(text))

        node.textContent = split

        overlay.insertBefore(tag, node)
        overlayNodes.splice(nodeIndex, 0, tag)

        this.textMap[key] = text
        this.textMap[key + text.length] = split
        updateWordBorderArray()

        nodeIndex += 1
      }
    }

    /**
     * updateTag
     * 
     * If type is "r(eturn)" then we need to add an additional <br>
     * tag. Otherwise, we can insert `text` into the existing span
     *
     * @param  {object}  context  { index: charIndex
     *                            , node: index of node
     *                            , char: index of char within node
     *                            , type: "w" | "W" | "r"
     *                            }
     * @param  {string}  text     Text to insert at context.char in
     *                            node context.node
     */
    updateTag(context, text, type) {
      var alteredNodeIndex = context.node
      var node = overlayNodes[alteredNodeIndex]
      var key  = wordBorderArray[alteredNodeIndex]
      var content

      if (type === "r") {
        insertBreak()
      } else {
        insertTextIntoExistingSpan()
      }

      function insertBreak(argument) {
        content = document.createElement("br")
        overlay.insertBefore(content, node)
        overlayNodes.splice(alteredNodeIndex, 0, content)

        adjustTextMap(alteredNodeIndex, text, text.length, 0)
      }

      function insertTextIntoExistingSpan() {
        // Insert text into the existing span
        content = this.textMap[key].splice(context.char, 0, text)
        node.textContent = content

        adjustTextMap(alteredNodeIndex, content, text.length, 1)
      }
    }

    /**
     * adjustTextMap
     * 
     * When new text is added to a span, the starting index for the
     * following spans need to be adjusted to account for the new
     * text length. If text is added to a new span, 
     *
     * @param  {number}    alteredNodeIndex  index of node whose
     *                                       text has changed
     * @param  {<type>}    text              The revised text
     * @param  {Function}  increment         number of chars added
     * @param  {<type>}    offset            true when an existing
     *                                       node is updated, so
     *                                       only the following nodes
     *                                       need to be adjusted. If
     *                                       a new node is inserted
     *                                       then the current node at
     *                                       that position also needs
     *                                       to be moved to make
     *                                       space.
     */
    adjustTextMap(alteredNodeIndex,text,increment,offset) {
      var alteredKey = this.wordBorderArray[alteredNodeIndex]
      var key
        , value
        , ii

      if (increment) {
        alteredNodeIndex += offset
        ii = this.wordBorderArray.length

        while (ii-- > alteredNodeIndex) {
          key = this.wordBorderArray[ii]
          value = this.textMap[key]
          delete this.textMap[key]
          this.textMap[key + increment] = value
        }
      }  

      this.textMap[alteredKey] = text

      updateWordBorderArray()
    }


    updateWordBorderArray() {
      this.wordBorderArray = Object.keys(this.textMap) // strings
                  .map(function(string) { // convert to integers
                   return parseInt(string, 10)
                  })
                  .sort(function (a, b) { // sort numerically
                    return a - b
                  })
    }

    
    refreshDisplay(isKeyInput) {
      var activeNodeIndex = this.inputContext.before.node
      var activeKey
        , activeText
        , outsideWord
        , activeWordText

      if (activeNodeIndex === this.activeWordIndex) {
        if (activeNodeIndex < 0) {
          // We're just starting up. Nothing to do.
        } else if (isKeyInput) {
          removeSpanStyle(this.activeWordIndex)
        }

        return
      }

      activeKey = this.wordBorderArray[activeNodeIndex]
      activeText = this.textMap[activeKey]
      outsideWord = _W.test(activeText) || _rn.test(activeText)

      if (this.activeWordIndex === -1) {
        // We haven't just left a word, but we might have entered one
        setActiveWordIndex(activeNodeIndex, isKeyInput)
        return
      }

      activeWordText = this.textMap[this.wordBorderArray[this.activeWordIndex]]

      scrollLists(activeWordText)
      setColour(this.activeWordIndex, activeWordText)

      setActiveWordIndex(outsideWord ? -1 : activeNodeIndex)


      function setActiveWordIndex(nodeIndex, dontScroll) {
        var index = nodeIndex < 0 ? this.activeWordIndex : nodeIndex
        var nodeKey = this.wordBorderArray[index]
        var word = this.textMap[nodeKey]

        if (!dontScroll) {
          scrollLists(word)
        }

        this.activeWordIndex = nodeIndex
      }


      function removeSpanStyle(nodeIndex) {
        var span = overlayNodes[nodeIndex]
        span.style.color = null
      }


      function setColour(nodeIndex, word) {
        var span = overlayNodes[nodeIndex]
        var frequencyIndex = getFrequency(word)

        colourItem(frequencyIndex, span)
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
    constructor(CorpusSource, InputManager) {
      let defaults = localStorage.getItem("graded-writer")
                  || { languageCode: "ru", target: 500 }

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
      // Corpus, InputManager and ControlPanels instances
      // that the display is to change, so they need to be controlled
      // at this highest level. However, initialization can not
      // complete until we have corpus data

      this.shiftDown = this.initializeShiftDetector()

      this.initializeTarget(defaults.target)

      let corpus = this.corpus = new Corpus()
      let input = this.inputManager = new InputManager(corpus)
      this.controlPanels = new ControlPanels( corpus
                                            , input
                                            , elementIdMap
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


    initializeTarget(defaultTarget) {
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
      this.targetRange.min = this.step

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


    setTarget(value) {
      let target = this.corpus.setTarget(value)
      if (!target) {
        return console.log("Target value could not be set:", value)
      }

      this.target = target
      this.targetRange.value = target
      this.targetField.value = target

      this.inputManager.setTarget(target)
      this.controlPanels.setTarget(target)
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
    }
  }


  lx.gradedWriter = new GradedWriter(lx.Corpus)


})(window.lexogram)