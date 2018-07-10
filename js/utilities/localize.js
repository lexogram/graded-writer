/** localize.js **
 *
 * NEED TO CONNECT THIS to a system for recognizing plural forms
**/



;(function localizeLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }



  class Localize {
    constructor() {
      this.languageCode = "en"
      this.langCode = "en"
      this.localizedStrings = this._getLocalizedStrings()
    }


    setLanguage(langCode) {
      let codes = Object.keys(this.localizedStrings)

      if (codes.indexOf(langCode) < 0) {
        console.log("Unknown language code:", langCode)
      } else {
        this.languageCode = langCode
      }

      return this.languageCode
    }


    string(symbol, substitutes, langCode) {
      this.langCode = langCode || this.languageCode

      this.map = this.localizedStrings[this.langCode]
      let string = ""

      if (!this.map) {
        this.langCode = "en"
        this.map = this.localizedStrings[this.langCode]
      }

      string = this.map[symbol]

      if (!string) {
        // The specific language map exists, but it doesn't contain
        // an entry for `symbol`. Assume that the "en" map has
        // everything we need, and return a non-localized string.
        // 
        this.langCode = "en"
        string = this.localizedStrings["en"][symbol] || symbol
      }

      string = this._replaceSubstitutes(string, substitutes)

      return string
    }


    _replaceSubstitutes(string, substitutes) {
      let keys = Object.keys(substitutes || {})

      keys.forEach((key) => {
        let substitute = substitutes[key]
        string = this._pluralize(string, key, substitute)

        substitute = this.string(substitute, {}, this.langCode)
        string = string.replace(new RegExp(key, "g"), substitute)
      })

      return string
    }


    // PLURALIZING // PLURALIZING // PLURALIZING // PLURALIZING //
    //
    // https://developer.mozilla.org/en-US/docs/Mozilla/Localization/Localization_and_Plurals#Developing_with_PluralForm

    /**
     * Returns a string where the correct plural form is used for 
     * substitutions which appear in square brackets
     * 
     * @param  {string}  string      "String: %0 %1 [%1, substitution]"
     * @param  {string}  key         "%0" or similar non-word key
     * @param  {string}  substitute  { "%0": "with"
     *                               , "%1": <integer \ string number>
     *                               }
     */

    _pluralize(string, key, substitute) {
      let plural_rule = "_applyRule_" + this.map.plural_rule.substr(1)
      let pluralRegex = new RegExp("\\["+key+",\\s([^]+)\\]")

      let match = pluralRegex.exec(string)

      // [ "[<key>, <substitute string>]"
      // , "<substitute string>"
      // , index: <integer>
      // , input: "Text with <key> [<key>, <substitute string>]"
      // , length: 2
      // ]
      
      if (match) {
        match.string = string
        match.substitute = "" + substitute // ensures number is string
        match.plurals = this.map[match[1]].split(";")
                     // "singular;plural" => ["singular", "plural"]

        string = this[plural_rule](match)
      }

      return string
    }

    /**
     * Families: Germanic (Danish, Dutch, English, Faroese, Frisian,
     * German, Norwegian, Swedish), Finno-Ugric (Estonian, Finnish,
     * Hungarian), Language isolate (Basque), Latin/Greek (Greek),
     * Semitic (Hebrew), Romanic (Italian, Portuguese, Spanish,
     * Catalan), Vietnamese
     * 
     * is 1: 1
     * everything else: 0,      2,  3,  4,  5,  6,  7,  8,  9,
     *                 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
     *                 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
     *                 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
     *                 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
     *                 50, …
     */
    _applyRule_1(options) {
      let flexion = ""

      switch (options.substitute) {
        case "1":
          flexion = options.plurals[0]
        break
        default:
          flexion = options.plurals[1]
      }

      let string = options.string.replace(options[0], flexion)

      return string
    }


    /**
     * Families: Slavic (Belarusian, Bosnian, Croatian, Serbian,
     *                   Russian, Ukrainian)
     * ends in 1, excluding 11: 
     *     1,       21,  31,  41,  51,  61,  71,  81,  91,
     *   101,      121, 131, 141, 151, 161, 171, 181, 191,
     *   201,      221, 231, 241, 251, 261, 271, 281, 291, …
     * ends in 2-4, excluding 12-14:
     *     2,   3,   4,
     *     
     *    22,  23,  24,
     *    32,  33,  34,
     *   ...
     *    92,   93, 94,
     *   102, 103, 104,
     *   
     *   122, 123, 124,
     *   132, 133, 134, 
     *   ...
     *   192, 193, 194 …
     * everything else: 
     *     0,                       5,   6,   7,   8,   9,
     *    10,  11,  12,  13,  14,  15,  16,  17,  18,  19,
     *    20,                      25,  26,  27,  28,  29,
     *   ...
     *    90,                      95,  96,  97,  97,  99,
     *   100,                     105, 106, 107, 108, 109, ...
     *
     * @param      {<type>}  options  The options
     */
    _applyRule_7(options) {
      let flexion     = ""
      let last2digits = options.substitute.slice(-2)

      switch (last2digits) {
        case "11":
        case "12":
        case "13":
        case "14":
          flexion = options.plurals[2]
        break

        default:
          switch (last2digits.slice(-1)) {
            case "1":
              flexion = options.plurals[0]
            break

            case "2":
            case "3":
            case "4":
              flexion = options.plurals[1]
            break

            default:
              flexion = options.plurals[2]
          }
      }

      let string = options.string.replace(options[0], flexion)

      return string
    }


    _getLocalizedStrings() {
      return {
        ru: {
          plural_rule: "#7"

        , "символ": "символ;символа;символов"

        , "undoTypeTip": "Удалить [%0, символ] %1"
        , "redoTypeTip": "Печатать %0 [%0, символ]"
        , "undoPasteTip": "Вырезать [%0, символ] %1"
        , "redoPasteTip": "Вставить %0 [%0, символ]"
        }
      , en: {
          plural_rule: "#1"

        , "char": "character;characters"

        , "undoTypeTip": "Delete [%0, char] %1"
        , "redoTypeTip": "Type %0 [%0, char]"
        , "undoPasteTip": "Cut [%0, char] %1"
        , "redoPasteTip": "Paste %0 [%0, char]"
        }
      }
    }
  }



  lx.localize = new Localize()
  
})(window.lexogram)