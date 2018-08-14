/** inputManger.js **
 * TODO:
 * Merge start and end span
 * Erase selection
 * Deal with cut
 * Create UndoAction for key input
 *  - delete
 *  - backspace
 *  - type
 *  - cut
 *
 * Do type, backspace and delete
 *

 * Detect out-of-range words used in text
 * Add out-of-range words as they are inserted
 * (Alphabetical order. Collapse capitalized if lowercase exists,
 *  unless capitalization occurs in mid-sentence.)
 *
 * Use a subclass per language that adds language-specific utilities
 * - Russian
 *   - Corpus includes accentuation marks
 *   - Add contextual menu to Toolbar to show ́, ё or no accents
 *   - Create LUT to look for frequency index whether accented or not
 * - Thai
 *   - Word delimitation
 *

 */

;(function inputMangerLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }

  window.feedback = document.querySelector("#feedback p")

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
    constructor(corpus, undoRedo, panels) {
      this.corpus = corpus
      this.undoRedo = undoRedo
      this.panels = panels

      // <<< HARD-CODED
      let inputSelector = "#input textarea"
      let overlaySelector = "#input p"
      // HARD-CODED >>>

      this.input = document.querySelector(inputSelector)
      this.overlay = document.querySelector(overlaySelector)
      this.overlayNodes = []

      // Detect line breaks on any platform
      this.lineBreakRegex = /[\r|\r\n|\n]+/g

      // this.wordBorderArray  = [0]
      // this.chunkArray       = [""]
      // this.chunkTypeArray   = ["$"]
      this.inputContext    = {}
      this.activeNodeIndex = -1
      this.activeWord      = ""

      // Set default values and initialize with no text
      this.regex = /.^/
      this.findWords = true
      this.load("", true)

      // Key and mouse events
      let listener = this.treatKeyUp.bind(this)
      this.input.addEventListener("keyup", listener, true)
      listener = this.changeInsertionRoot.bind(this)
      this.input.addEventListener("mouseup", listener, true)

      listener = this.interceptPaste.bind(this)
      this.input.addEventListener("paste", listener, true)
      listener = this.interceptCut.bind(this)
      this.input.addEventListener("cut", listener, true)
    }


    /**
     * Sent by the callbackWith(languageData) method of the
     * Graded Writer instance, when a new corpus is loaded.
     *
     * @param      {RegExp}  regex      The regular expression
     * @param      {<type>}  findWords  true if regex is designed to
     *                                  find words, false if it is
     *                                  designed to detect non-words
     */
    setWordDetection(regex, findWords) {
      this.regex = new RegExp(regex, "g")
      this.findWords = findWords

      // this.updateInputContext()
    }


    /**
     * Sent by the setTarget() method of the Graded Writer instance
     * when the target range element is updated. The Corpus instance
     * will already have been told about the new target, so calls to
     * this.corpus.getWordColour() made by _recolourWordNode() will
     * return the appropriate colour for the new target.
     */
    setTarget() {
      let total = this.overlayNodes.length
      let ii

      for (ii = 0; ii < total; ii += 1) {
        if (this.chunkTypeArray[ii] === "w") {
          this._recolourWordNode(ii)
        }
      }
    }


    /**
     * Sent by the constructor and from an external script (TBD)
     *
     * Replaces all the text with new text.
     *
     * @param  {string}   text           New text to display
     * @param  {boolean}  isNotUndoable  Indicates if not undoable.
     *                                   true when called from the
     *                                   constructor
     */
    load(text, isNotUndoable) {
      if (typeof text !== "string") {
        return console.log("Attempting to load non-string text:"
                          , text)
      }

      let startSpan = document.createElement("span")
      startSpan.classList.add("start")
      let endSpan = document.createElement("span")
      endSpan.classList.add("end")

      this._replaceContentsOf(this.overlay, startSpan, endSpan)

      this.wordBorderArray = [0, 0]
      this.chunkArray      = ["", ""]
      this.chunkTypeArray  = ["^", "$"]
      this.overlayNodes    = [startSpan, endSpan]

      this.paste(text, 0, isNotUndoable)
    }


    /**
     * Called by the browser when an onpaste event is triggered on
     * the input textarea, before the paste operation is actually made
     *
     * Grabs the text in the clipboard and uses it to update the
     * overlay. The browser will only update the textarea after this
     * operation is complete.
     *
     * @param  {<type>}  event   A paste event
     */
    interceptPaste(event) {
      let text = event.clipboardData.getData('text/plain')
      let start = this.input.selectionStart
      let end = this.input.selectionEnd

      if (start !== end) {
        this.cut()
      }

      this.paste(text, start, false)
    }


    /**
     * Called by the browser when an oncut event is triggered on
     * the input textarea, before the cut operation is actually made.
     * The cut data will already be on the clipboard, but it will not
     * yet have been removed from the input textarea.
     *
     */
    interceptCut(event) {
      this.cut()
      event.preventDefault()
    }


    /**
     * Sent by interceptPaste(), after the current selection has been
     * cut, and by an UndoAction instance.
     *
     * Adds the text at insertPoint, and updates the various Model
     * arrays.
     *
     * @param      {<type>}  text         The text to paste
     * @param      {string}  insertPoint  The insert point
     * @param      {<type>}  ignoreUndo   true if the call comes from
     *                                    an UndoAction instance
     */
    paste(text, insertPoint, ignoreUndo, selection) {
      let length = text.length

      // Update input textarea
      //this.input.value = this.input.value.splice(insertPoint, 0, text)
      this._updateInput(insertPoint, 0, text)

      //console.log(this.input.value)

      if (!ignoreUndo) {
        let endPoint = insertPoint + length

        let undoSub = (length === 1)
                    ? insertPoint
                    : insertPoint + " - " + endPoint

        let undoData = {
          type: "paste"
          , text: text
          , redoFunction: this.paste.bind(this)
          , redoData: [text, insertPoint]
          , redoSelection: [insertPoint, endPoint]
          , redoTip: "redoPasteTip" // "Paste _num [_num, char]"
          , redoSub: { "_num": length }
          , undoFunction: this.cut.bind(this)
          , undoData: [insertPoint, endPoint]
          , undoSelection: [insertPoint, insertPoint]
          , undoTip: "undoPasteTip" // "Cut [_num, char] _pos"
          , undoSub: { "_num": length, "_pos": undoSub }
        }

        this.undoRedo.track(undoData)
      }

      let insertArrayMap = this._getInsertMap(text, insertPoint)
      let insertSpanCount = insertArrayMap.chunkArray.length

      let nodeIndex = this._electivelySplitAt(insertPoint)
      // index of node after the split.

      // may split a node into two of the same type
      this._shiftSubsequentSpans(nodeIndex, length)

      this._insertSpans(nodeIndex, insertArrayMap)
      this._insertArrays(nodeIndex, insertArrayMap)

      this._electivelyMergeTerminalSpans(nodeIndex, insertSpanCount)

      //console.log(this.input.value)
      if (selection) {
        this.input.setSelectionRange(...selection)
      }
    }


    /**
     * Sent by interceptCut(), paste(), _postProcessKeyUp() and by an
     * UndoAction instance
     *
     * @param  {string}  start       The index of the first char to
     *                               cut
     * @param  {string}  end         The index of the char after the
     *                               end of the cut
     * @param  {<type>}  ignoreUndo  true if the call comes from an
     *                               UndoAction instance
     *

     * All the above will be undefined if the call came from

     * _postProcessKeyUp()
     */
    cut(start, end, ignoreUndo, selection) {
      let dontCutFromTextArea = start === "dontCutFromTextArea"

      if (ignoreUndo) {
        // Create the selection manually
        this._setInputContext(start, end)
      }

      if (!this.inputContext.selectCount) {
        return
      }

      if (!ignoreUndo) {
        start = this.inputContext.before.index
        end = this.inputContext.after.index

        let text = this.inputContext.selection

        let undoData = {
          type: "cut"
          , text: text
          , redoFunction: this.cut.bind(this)
          , redoData: [start, end]
          , redoSelection: [start, start]
          , redoTip: "redoCutTip" // Cut [_num, char] _pos
          , redoSub: { "_num": end - start
                     , "_pos": start + " - " + end}
          , undoFunction: this.paste.bind(this)
          , undoData: [text, start]
          , undoSelection: [start, end]
          , undoTip: "undoCutTip" // Restore _num [_num, char]
          , undoSub: { "_num": start - end}
        }

        this.undoRedo.track(undoData)

        // console.log("CUT", {
        //   "text": text
        // , "start": this.inputContext.before.index
        // , "end": this.inputContext.after.index
        // , "ignoreUndo": ignoreUndo
        // })
      }

      let cutAdjust = start - end
      let before = this.inputContext.before
      let after = this.inputContext.after

      this._removeAnyIntermediateNodes(dontCutFromTextArea)

      if ( before.node === after.node ) {
        this._pruneNode(dontCutFromTextArea)
      } else if ( before.type === after.type ) {
        this._mergeBeforeAndAfterCut()
      } else {
        this._adjoinBeforeAndAfterCut()
      }

      this._shiftSubsequentSpans(before.node + 1, cutAdjust)

      //console.log("After ", this.wordBorderArray)
      if (selection) {
        this.input.setSelectionRange(...selection)
      }
    }


    // EVENTS // EVENTS // EVENTS // EVENTS // EVENTS // EVENTS //

    treatKeyUp(event) {
      let processed = this._postProcessKeyUp(event)

      if (processed) {
        this.updateInputContext(event)
      }
    }


    changeInsertionRoot(event) {
      this._setInputContext()

      if (this.inputContext.selectCount === 0) {
        let undoData = {
          type: "fix"
        , fixPoint: this.inputContext.before.index
        }

        this.undoRedo.track(undoData)

        //console.log("FIX: fixPoint =", undoData.fixPoint)
      }

      this._refreshDisplay(false) // not key input
    }


    /**
     * Sent by a keyup or mouseup event (treatKeyUp) and  by
     * setWordDetection()
     *
     * Ensures that the textModel is updated in the right place
     * when the user types, pastes or cuts text. To do this, creates
     * this.inputContext object with a format like:
     *
     *  { "before": {
     *      "index": 51
     *    , "node":  18
     *    , "char":  2
     *    , "text":  "давно"
     *    , "type":  "w"
     *    }
     *  , "after": {
     *      "index": 52
     *    , "node":  18
     *    , "char":  3
     *    , "text":  "давно"
     *    , "type":  "w"
     *    }
     *  , "selectCount": 1
     *  }
     *
     * @param  {event}  event   mouseup or keyup event,
     *                          or undefined if the call comes from
     *                          setWordDetection()
     */
    updateInputContext(event) {
      this._setInputContext()

      // We don't want the frequency list to scroll on
      // refreshDisplay() if the user is simply starting a new word
      let isKeyInput = event
                    && event.type === "keyup"
                    && event.key.length === 1

      this._refreshDisplay(isKeyInput)
    }


    // PRIVATE METHODS // PRIVATE METHODS // PRIVATE METHODS //

    _treatInput(type, key) {
      if (type === "b") {
        return this._backspace()

      } else if (type === "d") {
        return this._delete()
      }

      this._insert(type, key)
    }


    /**
     * _backspace removes one character at a time. The start index of
     * the removal decrements by one each time, and the length of the
     * deleted text increases by one.
     *
     * @return     {<type>}  { description_of_the_return_value }
     */
    _backspace() {
      let before = this.inputContext.before
      let after = this.inputContext.after

      if (before.type === "^") {
        return
      }

      let start = before.index - 1
      let char = this._removeChar(before, before.char - 1)

      if (before.char === 1 && before.type !== after.type) {
        // The last character in a node has been removed.

        this._removeEmptyNode(before.node)
        // The index of after is now equal to before.node
        this._mergeNodes(before.node - 1, before.node)
      }

      let undoData = {
        type: "backspace"
        , text: char
        , redoFunction: this.cut.bind(this)
        , redoData: [start, start + 1]
        , redoSelection: [start, start]
        , redoTip: "redoDeleteTip" // Delete [_num, char] _pos
        , redoSub: { "_num": 1
                   , "_pos": start}
        , undoFunction: this.paste.bind(this)
        , undoData: [char, start]
        , undoSelection: [start + 1, start + 1]
        , undoTip: "undoDeleteTip" // Restore _num [_num, char]
        , undoSub: { "_num": 1 }
      }

      // console.log("Backspace", undoData)

      this.undoRedo.track(undoData)
    }


    _delete() {
      let after = this.inputContext.after

      if (after.type === "$") {
        return
      }

      let start = after.index
      let char = this._removeChar(after, after.char)
      // after is left unchanged

      if (after.text.length === 1) {
        // The after span is empty now that its only char is gone
        let nodeIndex = after.node
        this._removeEmptyNode(nodeIndex)
        // nodeIndex now refers to the following node
        this._mergeNodes(this.inputContext.before.node, nodeIndex)
      }

      let undoData = {
        type: "delete"
      , text: char
      , redoFunction: this.cut.bind(this)
      , redoData: [start, start + 1]
      , redoSelection: [start, start]
      , redoTip: "redoDeleteTip" // Delete [_num, char] _pos
      , redoSub: { "_num": 1
                 , "_pos": start}
      , undoFunction: this.paste.bind(this)
      , undoData: [char, start]
      , undoSelection: [start, start]
      , undoTip: "undoDeleteTip" // Restore _num [_num, char]
      , undoSub: { "_num": 1}
      }

      this.undoRedo.track(undoData)
    }


    _removeChar(context, charIndex) {
      let alteredNodeIndex = context.node
      let node = this.overlayNodes[alteredNodeIndex]
      let chunk = this.chunkArray[alteredNodeIndex]
      let char = chunk[charIndex]

      chunk = chunk.splice(charIndex, 1)
      node.innerText = chunk
      this.chunkArray[alteredNodeIndex] = chunk

      this._shiftSubsequentSpans(alteredNodeIndex + 1, -1)

      return char
    }


    _removeEmptyNode(nodeIndex) {
      let element = this.overlayNodes.splice(nodeIndex, 1)[0]
      this.overlay.removeChild(element)

      this.chunkArray.splice(nodeIndex, 1)
      this.chunkTypeArray.splice(nodeIndex, 1)
      this.wordBorderArray.splice(nodeIndex, 1)
    }


    /**
     * Called by _treatInput(), itself called by _postProcessKeyUp()
     * following a treatKeyUp() event
     *

     * @param  {"w" | "W"}  type
     *     This indicates whether the character to insert is a word
     *     or a non-Word character.
     * @param  {string}   key
     *     A single printable character

     */
    _insert(type, key) {
      let before = this.inputContext.before
      let after = this.inputContext.after

      if (type === before.type) {
        // We may be extending a sequence or inserting in the
        // middle of it
        this._updateTag(before, key)

      } else if (type === after.type) {
        // We are prefixing a sequence
        this._updateTag(after, key)

      } else {
        // The type to insert is different from the type already
        // at this position
        if (before.node === after.node) {
          this._splitNode(before, after)
        }

        this._insertNewSpan(type, key)
      }

      let insertPoint = after.index
      let undoData = {
        type: "type"
        , text: key
        , redoFunction: this.paste.bind(this)
        , redoData: [key, insertPoint]
        , redoSelection: [insertPoint + 1, insertPoint + 1]
        , redoTip: "redoTypeTip"
        , redoSub: { "_num": 1 }
        , undoFunction: this.cut.bind(this)
        , undoData: [insertPoint, insertPoint + 1]
        , undoSelection: [insertPoint, insertPoint]
        , undoTip: "undoTypeTip"
        , undoSub: { "_num": 1
                   , "_pos": insertPoint}
      }

      this.undoRedo.track(undoData)

      //console.log("TYPE: key =", key)
    }


    /**
     * Splits a node at before.index (before.char), by truncating the
     * current node and inserting a new node after it. The numbering
     * of the subsequent nodes will remain unchanged.
     *
     * @param  {<type>}  type    "w" | "W"
     * @param  {<type>}  before  Context object to define the
     *                           character before the split. Format:
     *                           { index: charIndex
     *                           , node: index of node
     *                           , char: index of char within node
     *                           , type: <"w" | "W">
     *                           , text: <string>
     *                           }
     * @param  {<type>}  after   Context object for character after
     *                           the split.
     *

     * `after` is a pointer to `this.inputContext.after`. This will be
     *  modified so that it represents the new node that will be
     *  created by the call to _insertNewSpan()
     *

     * this.inputContext will be updated to allow subsequent
     * methods to work as if the split had always existed.
     */
    _splitNode(before, after) {
      let nodeIndex  = before.node
      let charIndex  = before.char
      let type       = before.type
      let text       = before.text
      let splitText  = text.substring(charIndex)

      // Truncate current node...
      text           = text.substring(0, charIndex)
      let node       = this.overlayNodes[nodeIndex]
      node.innerText = text
      // ... truncate the entry in this.chunkArray
      this.chunkArray[nodeIndex] = text
      // ...  and update this.inputContext.before
      before.text    = text

      // Prepare this.inputContext.after to describe the node that
      // is about to be created.

      after.node     += 1 // SEE * BELOW
      after.char     = 0
      after.text     = splitText

      // * Right now, after.node refers to an existing node which will
      //   be the used with HTMLElement.insertBefore() to place the
      //   span which will be created in the next call.

      // Create a new node and entries in wordBorderArray,
      // chunkArray and chunkTypeArray, but don't change the
      // subsequent entries in wordBorderArray
      this._insertNewSpan(type, splitText, "dontShift")
    }


    /**
     * Sent by _insert() and _splitNode()
     *
     * @param  {char}      type         "w" | "W"
     * @param  {string}    text         The string for the new node
     * @param  {"boolean"} ignoreShift  truthy if the call comes from
     *                           _splitNode(), in which case text has
     *                           been shifted from one node to this
     *                           new node, but no new text has been
     *                           added.
     */
    _insertNewSpan(type, text, ignoreShift) {
      let after = this.inputContext.after
      let span
        , colour
        , nodeIndex
        , index
        , afterNode

      span = document.createElement("span")
      span.innerText = text

      if (type === "w") {
        colour = this.corpus.getWordColour(text)
        span.style.color = colour
      }

      nodeIndex = after.node
      index     = after.index
      afterNode = this.overlayNodes[nodeIndex]
      this.overlay.insertBefore(span, afterNode)

      this.overlayNodes.splice(nodeIndex, 0, span)
      this.chunkArray.splice(nodeIndex, 0, text)
      this.chunkTypeArray.splice(nodeIndex, 0, type)
      this.wordBorderArray.splice(nodeIndex, 0, index)

      if (!ignoreShift) {
        this._shiftSubsequentSpans(nodeIndex + 1, text.length)
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
    _updateTag(context, text) {
      var alteredNodeIndex = context.node
      var node = this.overlayNodes[alteredNodeIndex]
      var border = this.wordBorderArray[alteredNodeIndex]
      var chunk = this.chunkArray[alteredNodeIndex]

      // Insert text into the existing span
      chunk = chunk.splice(context.char, 0, text)
      node.innerText = chunk
      this.chunkArray[alteredNodeIndex] = chunk

      this._shiftSubsequentSpans(alteredNodeIndex + 1, text.length)
    }


    _setInputContext(start, end) {
      let useSelection = isNaN(start)

      if (useSelection) {
        start = this.input.selectionStart
        end   = this.input.selectionEnd
      }

      let before = this._getInsertionContext(start)
      let after  = this._getInsertionContext(end, true)
      let text   = this.input.value.substring(start, end)

      this.inputContext = {
        before: before
      , after:  after
      , selectCount: end - start
      , selection: text
      }
    }


    /**
     * Called twice by updateInputContext(), after a mouseup or keyup
     * event, once for the beginning of the current selection, once
     * for the end.
     *

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
     *         , type: "w" | "W" (word | non-Word)
     *         , text: <string>
     *         }
     */
    _getInsertionContext (charIndex, isAfter) {
      if (charIndex < 0) {
        charIndex = 0
        isAfter = false
      }

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
          context.text = ""
          context.node = 0
          context.char = 0
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


    /**
     * Called by _getInsertionContext() and _electivelySplitAt())
     *
     * @param  {number}  charIndex  The character index
     *

     * @return {object}  { nodeIndex: <integer>
     *                   , charInNode: <integer>
     *                   }
     */
    _getNodeAndCharIndex(charIndex) {
      let nodeIndex = this.wordBorderArray.length - 1
      let nodeStartChar = this.wordBorderArray[nodeIndex]
      let charInNode = false

      while (nodeStartChar > charIndex) {
        nodeIndex -= 1
        nodeStartChar = this.wordBorderArray[nodeIndex]
        charInNode = true
      }

     charInNode = charInNode ? charIndex - nodeStartChar : 0

      return {
        nodeIndex: nodeIndex
      , charInNode: charInNode
      }
    }


    // CUT // CUT // CUT // CUT // CUT // CUT // CUT // CUT // CUT //

    _removeAnyIntermediateNodes(dontCutFromTextArea) {
      let start = this.inputContext.before.node + 1
      let count = this.inputContext.after.node - start

      if (count < 1) {
        // There are no intermediate nodes to remove
        return
      }

      // Update model
      this.chunkArray.splice(start, count)
      this.chunkTypeArray.splice(start, count)
      this.wordBorderArray.splice(start, count)

      // Update view
      let nodesToRemove = this.overlayNodes.splice(start, count)
      nodesToRemove.forEach((element) => {
        this.overlay.removeChild(element)
      })

      if (!dontCutFromTextArea) {
        // Update textarea
        start = this.inputContext.before.index
        count  = this.inputContext.after.index - start
        this._updateInput(start, count, "")
      }
    }


    _updateInput(start, count, text = "") {
      let selectEnd = this.input.selectEnd + text.length - count
      this.input.value = this.input.value.splice(start, count, text)
      this.input.setSelectionRange(selectEnd, selectEnd)
    }


    _pruneNode(dontCutFromTextArea) {
      let nodeIndex = this.inputContext.before.node
      let start = this.inputContext.before.char
      let end = this.inputContext.after.char
      let adjust = start - end

      // Update model
      let chunk = this.chunkArray[nodeIndex].splice(start, adjust)
      this.chunkArray[nodeIndex] = chunk
      this.inputContext.before.text = chunk

      // Update view
      this.overlayNodes[nodeIndex].innerText = chunk
      //this._recolourWordNode(nodeIndex)

      if (!dontCutFromTextArea) {
        // Update textarea
        start = this.inputContext.before.index
        this._updateInput(start, adjust)
      }

      // Adjust inputContext now that the selection is removed
      this.inputContext.after = JSON.parse(
                                  JSON.stringify(
                                    this.inputContext.before
                                  )
                                )
    }


    _mergeBeforeAndAfterCut() {
      let before = this.inputContext.before
      let after = this.inputContext.after

      // Update before
      let text = before.text.substring(0, before.char)

               + after.text.substring(after.char)

      let nodeIndex = before.node
      let node = this.overlayNodes[nodeIndex]
      node.innerText = text
      this.chunkArray[nodeIndex] = text

      // Delete after
      nodeIndex += 1
      this.chunkArray.splice(nodeIndex, 1)
      this.chunkTypeArray.splice(nodeIndex, 1)
      this.wordBorderArray.splice(nodeIndex, 1)
      node = this.overlayNodes.splice(nodeIndex, 1)[0]
      this.overlay.removeChild(node)
    }


    _adjoinBeforeAndAfterCut() {
      let before = this.inputContext.before
      let after = this.inputContext.after

      // Trim before
      let nodeIndex = before.node
      let text = before.text.substring(0, before.char)
      this.overlayNodes[nodeIndex].innerText = text
      this.chunkArray[nodeIndex] = text

      // Trim after
      nodeIndex += 1
      text = after.text.substring(after.char)
      this.overlayNodes[nodeIndex].innerText = text
      this.chunkArray[nodeIndex] = text
    }


    /**
     * Sent by load()
     *

     * Removes all the children of parent and then adds the single
     * element in their place
     *
     * @param      {<type>}  parent   The node to empty (this.overlay)
     * @param      {<type>}  element  The element to add:
     *                                <span class="end"></span>
     */
    _replaceContentsOf(parent, ...elements) {
      let child

      while (child = parent.lastChild) {
        parent.removeChild(child)
      }

      elements.forEach((element) => {
        parent.appendChild(element)
      })
    }


    _getInsertMap(chunk, insertPoint) {
      let wordBorderArray = []
      let chunkArray      = []
      let chunkTypeArray  = []

      let insertArrayMap = {
        wordBorderArray: wordBorderArray
      , chunkArray: chunkArray
      , chunkTypeArray: chunkTypeArray
      }

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

      this.regex.lastIndex = 0
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

      return insertArrayMap
    }


    _electivelySplitAt(insertPoint) {
      // toBeTested()

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
      let chunk2 = chunk1.substring(charInNode)
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


    /**
     * Sent by paste() AND BY CUT()
     *
     * @param  {number}  nodeIndex  The index of the first node whose
     *                              start char index is to be adjusted
     * @param  {number}  length     The number of characters that have
     *                              been added (+length) or removed
     *                              (-length)
     */
    _shiftSubsequentSpans(nodeIndex, length) {
      let ii = this.wordBorderArray.length
      for ( ; ii-- > nodeIndex ; ) {
        this.wordBorderArray[ii] += length
      }
    }


    /**
     * Sent by paste()
     *

     * Adds a new span before nodeIndex for each entry in

     * insertArrayMap.chunkArray
     *
     * @param  {array}  insertArrayMap  An object with the format
     *     { wordBorderArray: [<integer>, ...]
     *     , chunkArray: [<string: word | linebreak | non-word>. ... ]
     *     , chunkTypeArray: [<"w" | "r" | "W">, ...]
     *     }
     */
    _insertSpans(nodeIndex, insertArrayMap) {
      let chunkArray     = insertArrayMap.chunkArray
      let chunkTypeArray = insertArrayMap.chunkTypeArray

      let nextSibling = this.overlayNodes[nodeIndex]
      let length = chunkArray.length
      let ii
        , span
        , chunk
        , colour

      for ( ii = 0 ; ii < length ; ii += 1 ) {
        span = document.createElement("span")
        chunk = chunkArray[ii]
        span.innerText = chunk
        // *** ↵ characters are automatically converted to <br> ***

        if (chunkTypeArray[ii] === "w") {
          colour = this.corpus.getWordColour(chunk)
          span.style = "color:" + colour
        }

        this.overlayNodes.splice(nodeIndex + ii, 0, span)
        this.overlay.insertBefore(span, nextSibling)
      }
    }


    /**
     * Sent by paste()
     *

     * IUpdates the Model with the data for the text that has just
     * been inserted
     *
     * @param  {array}  insertArrayMap  An object with the format
     *     { wordBorderArray: [<integer>, ...]
     *     , chunkArray: [<string: word | linebreak | non-word>. ... ]
     *     , chunkTypeArray: [<"w" | "r" | "W">, ...]
     *     }
     */
    _insertArrays(nodeIndex, insertArrayMap) {
      let wordBorderArray = insertArrayMap.wordBorderArray
      let chunkArray      = insertArrayMap.chunkArray
      let chunkTypeArray  = insertArrayMap.chunkTypeArray

      this.wordBorderArray.graft(nodeIndex, wordBorderArray)
      this.chunkArray.graft(nodeIndex, chunkArray)
      this.chunkTypeArray.graft(nodeIndex, chunkTypeArray)
    }


    _electivelyMergeTerminalSpans(startIndex, insertedSpanCount) {
      if (!startIndex) {
        return
      }

      let nextIndex = startIndex + insertedSpanCount

      let  type = this.chunkTypeArray[nextIndex - 1]
      if (type === this.chunkTypeArray[nextIndex]) {
        this._mergeNodes(nextIndex - 1, nextIndex)
      }

      type = this.chunkTypeArray[startIndex - 1]
      if (type === this.chunkTypeArray[startIndex]) {
        this._mergeNodes(startIndex - 1, startIndex)
      }
    }


    _mergeNodes(first, second) {
      // Don't merge with bookend nodes
      let type = this.chunkTypeArray[first]

      if (type === "^") {
        return
      } else if (this.chunkTypeArray[second] === "$") {
        return
      }

      // Move all text to the first node
      let chunk = this.chunkArray[first] + this.chunkArray[second]
      this.overlayNodes[first].innerText = chunk
      this.chunkArray[first] = chunk

      // Remove all trace of the second node
      this.overlay.removeChild(this.overlayNodes[second])
      this.chunkArray.splice(second, 1)
      this.chunkTypeArray.splice(second, 1)
      this.wordBorderArray.splice(second, 1)
      this.overlayNodes.splice(second, 1)

      if (type === "w") {
        this._recolourWordNode(first)
      }

      // No renumbering because there is no change of length
    }


    /**
     * Sent by treatKeyUp() after a keyup event
     *
     * @param   {event}    event   A keyup event
     * @return  {boolean}  true if a key was added to the textarea,
     *                     and therefore treated; false if the key
     *                     that was released was a modifier key
     */
    _postProcessKeyUp(event) {
      let key = event.key

      let type = this._getType(key, event.keyCode)
      // "w(ord)"|(not )"W"ord|"r(eturn)"|"b(ackspace)"|"d"elete|false

      if (!type) {
        // The event is a modifier keypress
        return false
      } else if (type === "a") {
        // Arrow key: no text processing required
        this.changeInsertionRoot()
        return false
      }

      // Treat special case
      if (type === "r") {
        key = String.fromCharCode(10) // was "Enter"
        type = "W"
      }

      if (this.inputContext.selectCount) {
        // The selected text has already been deleted
        this.cut("dontCutFromTextArea") // creates an undo event

        if (type === "b" || type === "d") {
          return true // _this.cut() did all the work needed
        }

      }

      this._treatInput(type, key)

      return true
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
        // Arrow keys
        case 37:
        case 38:
        case 39:
        case 40:
          return "a"

        // Return keys
        case 10:
        case 13:
          return "r" // key will be changed to "↵", type to "W"

        // Delete and Backspace
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

      // Ensure that the regex is reset, or it might wrongly
      // return false
      this.regex.lastIndex = 0
      let isWord = (this.regex.test(key))
                 ? this.findWords
                 : !this.findWords

      return isWord ? "w" : "W"
    }


    /**
     * Sent by updateInputContext(), itself called by
     *   a keyup or mouseup event (treatKeyUp) and setWordDetection()
     *

     * If the user has moved the insertion caret inside a different
     * word, then the acceptable, corpus (and out-of-range) lists are
     * scrolled to show the current word. If the insertion caret has
     * just left a word, then the colour of that word is reset.
     *
     * @param  {boolean}  isKeyInput  Indicates if the call was
     *                                triggered by a visible key press
     *                                NOTE: not currently used
     */
    _refreshDisplay(isKeyInput) {
      let activeNodeIndex = this.inputContext.before.node
      let activeIsWord = this.chunkTypeArray[activeNodeIndex] === "w"
      let activeWord

      if (activeIsWord) {
        activeWord = this.chunkArray[activeNodeIndex]
      } else {
        activeWord = ""
        activeNodeIndex = -1
      }

      if (activeNodeIndex < 0 && this.activeNodeIndex < 0) {
        // The insertion point is still outside any words. No need
        // to scroll or colour anything.
        return

      }

      // Check for need to scroll: has the active word changed?

      if (activeIsWord && (activeWord !== this.activeWord)) {
        this.panels.scrollTo(activeWord)
      }

      this.activeWord = activeWord

      // Check for colour changes
      if (activeNodeIndex !== this.activeNodeIndex) {
        if (activeNodeIndex > -1) {
          this._removeNodeStyle(activeNodeIndex)
        }

        if (this.activeNodeIndex > -1) {
          this._recolourWordNode(this.activeNodeIndex)
        }

        this.activeNodeIndex = activeNodeIndex
      }


    }

    _recolourWordNode(nodeIndex) {
      let node = this.overlayNodes[nodeIndex]
      let text = node.innerHTML
      let colour = this.corpus.getWordColour(text)

      node.style.color = colour
    }


    _removeNodeStyle(nodeIndex) {
      let node = this.overlayNodes[nodeIndex]
      node.style.color = null
    }
  }

  lx.InputManager = InputManager

})(window.lexogram)