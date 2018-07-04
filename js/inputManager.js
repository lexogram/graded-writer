/** inputManger.js **
*
* TODO:
 * Create spans
 * Show spans in <p>
 * Merge start and end span
 * Erase selection
 * Deal with cut
 * 
 * Do type, backspace and delete
 * Colour spans
 * 
 * Use a subclass per language that adds language-specific utilities
 * - Russian
 *   - Corpus includes accentuation marks
 *   - Add contextual menu to Toolbar to show ́, ё or no accents
 *   - Create LUT to look for frequency index whether accented or not
 * - Thai
 *   - Word delimitation
 */

;(function inputMangerLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }


  window.feedback = document.querySelector("#feedback")


  /* POLYFILLS and HACKS */
    // http://stackoverflow.com/a/4314050/1927589
    if (!Array.prototype.graft) {
      /**
       * The graft() method is similar to splice(start, ... items),
       * except that...
       * - it does not remove any items
       * - it accepts an array rather than a series of parameters,
       *   in a an .apply()-like way.
       *
       * @this {Array}
       * @param {number} start
       *   Index at which to start splicing in the items of graftArray
       * @param {array}  graftArray
       *   An array of items to insert starting at start
       *   
       * @return {array} The original array, in its modified state
       */

      Array.prototype.graft = function(start, graftArray) {
        let tail = this.splice(start)
        this.push(...graftArray, ...tail)

        return this
      }
    }
  /* END POLYFILLS */


  class InputManager {
    constructor(corpus, trackActions, shortcutGenerator) {
      this.corpus = corpus
      this.trackActions = trackActions

      // <<< HARD-CODED
      let inputSelector = "#input textarea"
      let overlaySelector = "#input p"
      this.snippetLength = 15
      // HARD-CODED >>>

      this.input = document.querySelector(inputSelector)
      this.overlay = document.querySelector(overlaySelector)
      this.overlayNodes = []

      this.lineBreakRegex = /[\r|\r\n|\n]+/g // line break on any platform
      // var _W = /[\s!-\/:-@[-`{-~\u00A0-¾—-⁊$]/ // any non-word character
                                                // 
      // this.wordBorderArray  = [0] 
      // this.chunkArray       = [""]
      // this.chunkTypeArray   = ["$"]
      this.inputContext     = {}

      ////// ¿ARE THESE USED? //////
      this.oldLength = 0
      this.activeWordIndex = -1
 
      // Set default values and initialize with no text
      this.regex = null
      this.findWords = true
      this.load("", true)
      
      // Key and mouse events
      let listener = this.treatKeyUp.bind(this)
      this.input.addEventListener("keyup", listener, true)
      listener = this.updateInputContext.bind(this)
      this.input.addEventListener("mouseup", listener, true)

      listener = this.interceptPaste.bind(this)
      this.input.addEventListener("paste", listener, true)
      // listener = this.interceptCut.bind(this)
      // this.input.addEventListener("cut", listener, true)

      listener = this.beforeCut.bind(this)
      shortcutGenerator.register("cut", listener)
      // listener = this.paste.bind(this)
      // shortcutGenerator.register("paste", listener)
    }


    setWordDetection(regex, findWords) {
      this.regex = new RegExp(regex, "g")
      this.findWords = findWords

      // this.updateInputContext()
    }


    setTarget() {
      let colorItem = (colour, node) => {
        node.style = "color:"+colour+";"
      }

      let total = this.overlayNodes.length
      let ii
        , node
        , text
        , type
        , index
        , colour
      
      for (ii = 0; ii < total; ii += 1) {
        node = this.overlayNodes[ii]
        text = this.chunkArray[ii]
        type = this.chunkTypeArray[ii]

        if (type !== "w") {
          // Ignore spaces, numbers, punctuation and line breaks
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


    load(text, isNotUndoable) {
      if (typeof text !== "string") {
        return console.log("Attempting to load non-string text:"
                          , text)
      }

      let endSpan = document.createElement("span")
      endSpan.classList.add("end")
      this._replaceContentsOf(this.overlay, endSpan)

      this.input.value     = text
      this.wordBorderArray = [0] 
      this.chunkArray      = [""]
      this.chunkTypeArray  = ["$"]
      this.overlayNodes    = [endSpan]

      this.paste(text, 0, isNotUndoable)
    }


    interceptPaste(event) {
      let text = event.clipboardData.getData('text/plain')
      let start = this.input.selectionStart
      let end = this.input.selectionEnd

      if (start !== end) {
        // TODO: erase selection
      }

      this.paste(text, start, false)
    }


    beforeCut() {
      console.log("beforeCut")

      let start = this.input.selectionStart
      let end = this.input.selectionEnd

      if (start !== end) {
        // TODO: erase selection
      }

      this.cut(start, end, false)
    }


    // interceptCut(event) {
    //   console.log(event.type, "^", event.clipboardData.getData('text/plain'), "$")
    // }


    paste(text, insertPoint, ignoreUndo) {

      let length = text.length

      if (!ignoreUndo) {
        let endPoint = insertPoint + length
        let snippet = this._getSnippet(text)

        let undoData = {    
          type: "paste"
        , redoFunction: this.paste.bind(this)
        , redoData: [text, insertPoint]
        , redoTip: "Paste " + length + " chars"
                 + "\n" + snippet
        , undoFunction: this.cut.bind(this)
        , undoData: [insertPoint, endPoint]
        , undoTip: "Cut chars " + insertPoint + "-" + endPoint
                 + "\n" + snippet
        }

        this.trackActions.track(undoData)
      }

      let paragraphArray = this._getParagraphArray(text, insertPoint)
      // return console.log(lexogram.prettify(paragraphArray))
      let insertArrayMap = this._getInsertArrayMap(paragraphArray)
      //return console.log(insertArrayMap)

      let nodeIndex = this._electivelySplitAt(insertPoint)
      this._shiftSubsequentSpans(nodeIndex, length)
      // may split a node into two of the same type
      this._insertArraysAndSpans(nodeIndex, insertArrayMap)
    }


    cut (start, end, ignoreUndo) {
      let text = this.input.value.substring(start, end)

      if (!ignoreUndo) {
        let snippet = this._getSnippet(text)

        let undoData = {    
          type: "cut"
        , redoFunction: this.cut.bind(this)
        , redoData: [start, end]
        , redoTip: "Cut chars " + start + "-" + end
                 + "\n" + snippet
        , undoFunction: this.paste.bind(this)
        , undoData: [text, start]
        , undoTip: "Restore text"
                 + "\n" + snippet
        }

        this.trackActions.track(undoData)
      }

      console.log(text, {
        "this": this
      , "start": start
      , "end": end
      , "ignoreUndo": ignoreUndo
      })
    }

    // EVENTS // EVENTS // EVENTS // EVENTS // EVENTS // EVENTS //

    treatKeyUp(event) {
      let processed = this._postProcessKeyUp(event)

      if (processed) {
        this.updateInputContext(event)
      }
    }


    /**
     * Ensures that the textModel is updated in the right place
     * when the user types, pastes or cuts text
     *
     * @param      {<type>}  event   mouseup or keyup event
     */
    updateInputContext(event) {
      let start  = this.input.selectionStart
      let end    = this.input.selectionEnd
      let before = this._getInsertionContext(start)
      let after  = this._getInsertionContext(end, true)
     
      // We don't want the frequency list to scroll if the user is
      // simply starting a new word
      let isKeyInput = event
                    && event.type === "keyup" 
                    && event.key.length === 1

      this.inputContext = {
        before: before
      , after:  after
      , selectCount: end - start
      } 

      feedback.innerHTML = lexogram.prettify(this.inputContext, true)
      // this.refreshDisplay(isKeyInput)
    }


    // PRIVATE METHODS // PRIVATE METHODS // PRIVATE METHODS //

    _replaceContentsOf(parent, element) {
      let child

      while (child = parent.lastChild) {
        parent.removeChild(child)
      }

      parent.appendChild(element)
    }


    /**
     * Called by paste()
     * 
     * @param  {string}  text   the text that will be pasted
     * 
     * Returns an array with the format:
     * [ { index: <integer>
     *   , chunk: <paragraph | return character(s)>
     *   , type: <"p"        | "r">
     *   }
     * , ...
     * ]
     */
    _getParagraphArray(text, insertPoint) {
      let array = []
      let start = 0
      let end = text.length
      let lineBreakData
        , index
        , chunk

      let addText = (start, index) => { 
        array.push({
          index: start + insertPoint
        , chunk: text.substring(start, index)
        , type: "p"
        })
      }

      while (lineBreakData = this.lineBreakRegex.exec(text)) {
        // [ "↵"
        // , index: <positive integer>
        // , input: <string>
        // ]
        index = lineBreakData.index
        chunk = lineBreakData[0]

        if (index) {
          addText(start, index)
        }

        array.push({
          index: index + insertPoint
        , chunk: chunk
        , type: "r"
        })

        start = index + chunk.length
      }

      if (start < end) {
        addText(start, end)
      }

      return array
    }


    /**
     * Called by paste()
     * Returns an object with the format 
     * { wordBorderArray: [<integer>, ...]
     * , chunkArray: [<string: word | linebreak | non-word>. ... ]
     * , chunkTypeArray: [<"w" | "r" | "W">, ...]
     * }
     *
     * @param  {array}  paragraphArray  An array of objects with the
     * format:
     * [ { "index": <integer>
     *   , "chunk": <string: paragraph | linebreak(s)>
     *   , "type":  <"p"               | "r">
     *   }
     *  , ...
     *  }
     */
    _getInsertArrayMap(paragraphArray) {
      let wordBorderArray = []
      let chunkArray      = []
      let chunkTypeArray  = []

      let insertArrayMap = {
        wordBorderArray: wordBorderArray
      , chunkArray: chunkArray
      , chunkTypeArray: chunkTypeArray
      }


      let addLinebreakToInsertArrayMap = (chunkData) => {
        wordBorderArray.push(chunkData.index)
        chunkArray.push(chunkData.chunk)
        chunkTypeArray.push("r")
      }


      let addParagraphToInsertArrayMap = (chunkData) => {
        let chunk = chunkData.chunk
        let insertPoint = chunkData.index
        let length = chunk.length
        let start = 0
        let index
          , result

        let addUnmatchedChunk = (start, index) => {
          wordBorderArray.push(start + insertPoint)
          chunkArray.push(chunk.substring(start, index))
          chunkTypeArray.push(this.findWords ? "W" : "w")
        }

        let addChunk = (chunk, index) => {
          wordBorderArray.push(index + insertPoint)
          chunkArray.push(chunk)
          chunkTypeArray.push(this.findWords ? "w" : "W")

          start = index + chunk.length
        }

        while (result = this.regex.exec(chunk)) {
          // [ <first match>
          // , index: <non-negative integer>
          // , input: <string>
          // ]
          
          index = result.index

          if (index) {
            addUnmatchedChunk(start, index)
          }

          addChunk(result[0], index)     
        }

        if (start < length) {
          addUnmatchedChunk(start, length)
        }
      }


      let addToInsertArrayMap = (chunkData) => {
        switch (chunkData.type) {
          case "r":
            return addLinebreakToInsertArrayMap(chunkData)
          default:
            addParagraphToInsertArrayMap(chunkData)
        }
      }


      paragraphArray.forEach(addToInsertArrayMap)

      return insertArrayMap
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
    _getInsertionContext (charIndex, isAfter) {
      let context = { index: charIndex }
      let atTypeBoundary = false
      let nodeIndex
        , charInNode
        , char
        , text

      if (!charIndex) { 
        if (!isAfter) {
          // Special case: we're right at the beginning with
          // nothing selected.
          context.type = "^"
          context.node = -1
          return context
        }
      }

      // Find out which chunk the selection point is in 
      nodeIndex = this._getNodeAndCharIndex(charIndex) // object
      charInNode = nodeIndex.charInNode
      nodeIndex  = nodeIndex.nodeIndex // integer

      if (!isAfter) {
        if (!charInNode) {
          // Special case: the beginning of the selection is at
          // a type boundary. Because we tested for another 
          // special case earlier, we can be sure that nodeIndex
          // is 0 or greater.
          atTypeBoundary = true
          nodeIndex -= 1
        }
      }

      context.node = nodeIndex
      text = this.chunkArray[nodeIndex]
      context.char = atTypeBoundary ? text.length : charInNode
      context.text = text
      context.type = this.chunkTypeArray[nodeIndex]

      return context
    }


    _getNodeAndCharIndex(charIndex) {
      let nodeIndex = this.wordBorderArray.length - 1
      let nodeStartChar = this.wordBorderArray[nodeIndex]

      while (nodeStartChar > charIndex) {
        nodeIndex -= 1
        nodeStartChar = this.wordBorderArray[nodeIndex]
      }

      return {
        nodeIndex: nodeIndex
      , charInNode: nodeStartChar - charIndex
      }
    }


    _electivelySplitAt(insertPoint) {
      // TO BE TESTED //

      let indexData  = this._getNodeAndCharIndex(insertPoint)
      let charInNode = indexData.charInNode
      let nodeIndex  = indexData.nodeIndex

      if (charInNode) {
        nodeIndex = this._makeSplitAt(
          nodeIndex  // nodeIndex will be incremented by 1
        , charInNode
        , insertPoint
        )
      }

      return nodeIndex
    }


    _makeSplitAt(nodeIndex, charInNode, insertPoint) {
      let type   = this.chunkTypeArray[nodeIndex]
      let chunk1 = this.chunkArray[nodeIndex] // entire string
      let chunk2 = chunk.substring(charInNode)
      let node
        , nextSibling

      chunk1 = chunk1.substring(0, charInNode) // trimmed string

      // Trim the existing entry and node
      this.chunkArray[nodeIndex] = chunk1
      node = this.overlayNodes[nodeIndex]
      node.innerText = chunk1

      // Add a new entry for the remainder
      nodeIndex += 1
      this.chunkArray.splice(nodeIndex, 0, chunk2)
      this.chunkTypeArray.splice(nodeIndex, 0, type)
      this.wordBorderArray.splice(nodeIndex, 0, insertPoint)

      // Add a new one  
      nextSibling = node.nextSibling
      node = document.createElement("span") // no style yet
      node.innerText = chunk2
      this.overlayNodes.splice(nodeIndex, 0, node)
      this.overlay.insertBefore(node, nextSibling)

      return nodeIndex
    }


    _shiftSubsequentSpans(nodeIndex, length) {
      let ii = this.wordBorderArray.length
      for ( ; ii-- > nodeIndex ; ) {
        this.wordBorderArray[ii] += length
      }
    }


    /**
     * 
     *
     * @param  {array}  insertArrayMap  An object with the format 
     * { wordBorderArray: [<integer>, ...]
     * , chunkArray: [<string: word | linebreak | non-word>. ... ]
     * , chunkTypeArray: [<"w" | "r" | "W">, ...]
     * }
     */
    _insertArraysAndSpans(nodeIndex, insertArrayMap) {
      let wordBorderArray = insertArrayMap.wordBorderArray
      let chunkArray      = insertArrayMap.chunkArray
      let chunkTypeArray  = insertArrayMap.chunkTypeArray

      this.wordBorderArray.graft(nodeIndex, wordBorderArray)
      this.chunkArray.graft(nodeIndex, chunkArray)
      this.chunkTypeArray.graft(nodeIndex, chunkTypeArray)

      console.log(lexogram.prettify(this.wordBorderArray))
      console.log(lexogram.prettify(this.chunkArray))
      console.log(lexogram.prettify(this.chunkTypeArray))

      // this.createNodes()
    }

    
    _postProcessKeyUp(event) {
      let key = event.key 
      // let caret
      //   , text
      //   , newLength
      //   , type

      let type = this._getType(key, event.keyCode)
      // "w(ord)"|(not )"W"ord|"r(eturn)"|"b(ackspace)"|"d"elete|false     
       
      if (!type) {
        // The event is a modifier keypress
        return false
      } else if (type === "r") {
        key = String.fromCharCode(13) // was "Enter
      }

      // caret = input.selectionStart // after keyup === selectionEnd
      // text = input.value
      // newLength = text.length
      let newLength = input.value.length
      let overwrite = (newLength === this.oldLength
                    && this.inputContext.selectCount !== 1)

      if (overwrite) {
        this._overwrite()
      } else {
        this._insert(key, newLength, type)
      }

      return true
    }


    _overwrite() {
      alert ("Please don't use the overwrite feature yet")
    }

    
    _insert(key, newLength, type) {
      this.oldLength = newLength
      let deleteSection = this.inputContext.selectCount

      if (deleteSection) {
        _this.deleteSelection()

        if (type === "b" || type === "d") {
          return // _this.deleteSelection() did all the work needed
        }

      } else if (type === "b") {
        return _this._backspace()

      } else if (type === "d") {
        return this._delete()
      }
      
      this._treatInput(key, type)
    }


    _deleteSelection() {
      alert ("Please don't test selection yet")
      // Remove intervening nodes
      // Trim end of start node
      // Trim start of end node
      // EITHER combine two nodes OR leave nodes as is
      // Update this.chunkArray
      // Update this.wordBorderArray
    }


    _delete() {

    }


    _backspace() {

    }


    /**
     * ''
     *
     * @param  <"w" | "W">  type
     *     This indicates whether the character to insert is a word
     *     or a non-Word character.
     */
    _treatInput(key, type) {
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

      // Colour word(s) if switching to non-word
    }


    /**
     * Returns one of the following:
     * - b     — backspace
     * - d     — delete
     * - r     — carriage return / line break (¿is this necessary?)
     * - w     — keyCode is a word character
     * - W     — keyCode is punctuation, whitespace, a number or other
     *           non-word character
     * - false — modifier key is also pressed
     *
     * @param      {string}            key      The key code
     * @param      {number}            keyCode  The key code
     * @return     {(boolean|string)}  The type.
     */
    _getType(key, keyCode) {
      switch (keyCode) {
        case 13:
          return "r"
        case 8:
          return "b" // backspace
        case 46:
          return "d" // delete
      }

      if (key.length !== 1 // may be "Control" or "Shift"
          || event.altKey
          || event.ctrlKey
          || event.metaKey) {

        return false
      }

      // Fake a logical XOR
      //              key > \  "a"  \  " "
      // this.findWords v   ————————————————
      //               true \  "w"  \  "W"
      //                    ————————\———————
      //              false \  "W"  \  "w"
 
      let isWord = this.regex.test(key)
                 ? this.findWords
                 : !this.findWords

      return isWord ? "W" : "w"
    }


    _getSnippet(text) {
      if (/^\s*$/.test(text)) {
        return "<whitespace>"
      }

      if (text.length > this.snippetLength * 2 + 5) {
        text = text.substring(0, this.snippetLength) 
             + " ... "
             + text.substring(text.length - this.snippetLength)
      }

      return "\"" + text + "\""
    }

 
    // ORIGINAL CODE //
     
      
      // insertNewTag(tagType, text) {
      //   var tag
      //     , nodeIndex

      //   if (tagType === "r") {
      //     tag = document.createElement("br")

      //   } else {
      //     tag = document.createElement("span")
      //     tag.appendChild(document.createTextNode(text))
      //   }

      //   nodeIndex = this.inputContext.after.node
      //   if (oldLength && nodeIndex === this.inputContext.before.node) {
      //     splitNode(this.inputContext.before.char)
      //   }

      //   overlay.insertBefore(tag, overlay.childNodes[nodeIndex])
      //   this.overlayNodes.splice(nodeIndex, 0, tag)

      //   adjustChunkArray(nodeIndex, text, text.length, 0)

      //   /**
      //    * Splits the node at nodeIndex at charIndex. The existing node
      //    * keeps the end of the text and a new node with the start of
      //    * the text is inserted before it. The following are updated:
      //    * - chunkArray
      //    * - wordBorderArray
      //    * - overlayNode
      //    * - nodeIndex
      //    *
      //    * @param  {number}  charIndex  character index where node is
      //    *                              to be split.
      //    */
      //   function splitNode(charIndex) {
      //     var key = this.wordBorderArray[nodeIndex]
      //     var text = this.chunkArray[key]
      //     var split = text.substring(charIndex)
      //     var text = text.substring(0, charIndex)
      //     var node = this.overlayNodes[nodeIndex]
      //     var tag = document.createElement("span")
      //     tag.appendChild(document.createTextNode(text))

      //     node.textContent = split

      //     overlay.insertBefore(tag, node)
      //     this.overlayNodes.splice(nodeIndex, 0, tag)

      //     this.chunkArray[key] = text
      //     this.chunkArray[key + text.length] = split
      //     updateWordBorderArray()

      //     nodeIndex += 1
      //   }
      // }

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

          adjustChunkArray(alteredNodeIndex, text, text.length, 0)
        }

        function insertTextIntoExistingSpan() {
          // Insert text into the existing span
          content = this.chunkArray[key].splice(context.char, 0, text)
          node.textContent = content

          adjustChunkArray(alteredNodeIndex, content, text.length, 1)
        }
      }

      // /**
      //  * adjustChunkArray
      //  * 
      //  * When new text is added to a span, the starting index for the
      //  * following spans need to be adjusted to account for the new
      //  * text length. If text is added to a new span, 
      //  *
      //  * @param  {number}    alteredNodeIndex  index of node whose
      //  *                                       text has changed
      //  * @param  {<type>}    text              The revised text
      //  * @param  {Function}  increment         number of chars added
      //  * @param  {<type>}    offset            true when an existing
      //  *                                       node is updated, so
      //  *                                       only the following nodes
      //  *                                       need to be adjusted. If
      //  *                                       a new node is inserted
      //  *                                       then the current node at
      //  *                                       that position also needs
      //  *                                       to be moved to make
      //  *                                       space.
      //  */
      // adjustChunkArray(alteredNodeIndex,text,increment,offset) {
      //   var alteredKey = this.wordBorderArray[alteredNodeIndex]
      //   var key
      //     , value
      //     , ii

      //   if (increment) {
      //     alteredNodeIndex += offset
      //     ii = this.wordBorderArray.length

      //     while (ii-- > alteredNodeIndex) {
      //       key = this.wordBorderArray[ii]
      //       value = this.chunkArray[key]
      //       delete this.chunkArray[key]
      //       this.chunkArray[key + increment] = value
      //     }
      //   }  

      //   this.chunkArray[alteredKey] = text

      //   updateWordBorderArray()
      // }


      // updateWordBorderArray() {
      //   this.wordBorderArray = Object.keys(this.chunkArray) // strings
      //               .map(function(string) { // convert to integers
      //                return parseInt(string, 10)
      //               })
      //               .sort(function (a, b) { // sort numerically
      //                 return a - b
      //               })
      // }

      
      // refreshDisplay(isKeyInput) {
      //   var activeNodeIndex = this.inputContext.before.node
      //   var activeKey
      //     , activeText
      //     , outsideWord
      //     , activeWordText

      //   if (activeNodeIndex === this.activeWordIndex) {
      //     if (activeNodeIndex < 0) {
      //       // We're just starting up. Nothing to do.
      //     } else if (isKeyInput) {
      //       removeSpanStyle(this.activeWordIndex)
      //     }

      //     return
      //   }

      //   activeKey = this.wordBorderArray[activeNodeIndex]
      //   activeText = this.chunkArray[activeKey]
      //   outsideWord = _W.test(activeText) || _rn.test(activeText)

      //   if (this.activeWordIndex === -1) {
      //     // We haven't just left a word, but we might have entered one
      //     setActiveWordIndex(activeNodeIndex, isKeyInput)
      //     return
      //   }

      //   activeWordText = this.chunkArray[this.wordBorderArray[this.activeWordIndex]]

      //   scrollLists(activeWordText)
      //   setColour(this.activeWordIndex, activeWordText)

      //   setActiveWordIndex(outsideWord ? -1 : activeNodeIndex)


      //   function setActiveWordIndex(nodeIndex, dontScroll) {
      //     var index = nodeIndex < 0 ? this.activeWordIndex : nodeIndex
      //     var nodeKey = this.wordBorderArray[index]
      //     var word = this.chunkArray[nodeKey]

      //     if (!dontScroll) {
      //       scrollLists(word)
      //     }

      //     this.activeWordIndex = nodeIndex
      //   }


      //   function removeSpanStyle(nodeIndex) {
      //     var span = this.overlayNodes[nodeIndex]
      //     span.style.color = null
      //   }


      //   function setColour(nodeIndex, word) {
      //     var span = this.overlayNodes[nodeIndex]
      //     var frequencyIndex = getFrequency(word)

      //     colourItem(frequencyIndex, span)
      //   }
      // }
    // 
  }


  lx.InputManager = InputManager
  
})(window.lexogram)