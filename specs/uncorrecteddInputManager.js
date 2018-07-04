/** inputManger.js **
*
* 
*/

;(function inputMangerLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
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

      let total = this.overlayNodes.length
      let ii
        , node
        , text
        , index
        , colour
      
      for (ii = 0; ii < total; ii += 1) {
        node = this.overlayNodes[ii]
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
      this.overlayNodes.splice(nodeIndex, 0, tag)

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
        var node = this.overlayNodes[nodeIndex]
        var tag = document.createElement("span")
        tag.appendChild(document.createTextNode(text))

        node.textContent = split

        overlay.insertBefore(tag, node)
        this.overlayNodes.splice(nodeIndex, 0, tag)

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
      var node = this.overlayNodes[alteredNodeIndex]
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
        this.overlayNodes.splice(alteredNodeIndex, 0, content)

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
        var span = this.overlayNodes[nodeIndex]
        span.style.color = null
      }


      function setColour(nodeIndex, word) {
        var span = this.overlayNodes[nodeIndex]
        var frequencyIndex = getFrequency(word)

        colourItem(frequencyIndex, span)
      }
    }
  }



  lx.InputManager = InputManager
  
})(window.lexogram)