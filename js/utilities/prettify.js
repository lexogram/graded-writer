/** prettify.js **
 * 
 * v1.0.20180703-2245
 *
 * lx.prettify(<object>, <boolean>) returns either a plain text
 * string or an HTML formatted string, depending on whether the second
 * parameter is falsy or truthy.
 * 
 * If the first parameter is a string, the string is decomposed into
 * its individual letters. If it is another primitive (null, undefined
 * a boolean or a number), the output will be "{}"
 * 
 **/


;(function prettifyLoaded(lx){
  "use strict"


  if (!lx) {
    lx = window.lexogram = {}
  }


  lx.prettify = function prettify( object
                                 , asHTML = false
                                 , padding = 0
                                 ) {

    let isArray = Array.isArray(object)
    let firstLine = true
    let prettyString = padding
                     ? (isArray
                        ? (asHTML ? "[<br />" : "[\n")
                        : (asHTML ? "{<br />" : "{\n")
                       )
                     : ""
    let keys = Object.keys(object)

    let maxLength = keys.reduce(getMaxLength, 0)

    function getMaxLength(longestSoFar, currentKey) {
      let currentLength = currentKey.length
      return Math.max(currentLength, longestSoFar)
    }

    let parentSpaces = ""
    for ( let ii = 0; ii < padding; ii += 1 ) {
      parentSpaces += asHTML ? "&nbsp;" : " "
    }

    keys.forEach(addToPrettyString)

    if (!padding) {
      prettyString = (isArray
                      ? "["
                      : "{")
                   + prettyString.substring(asHTML ? 6 : 1)
    }

    return prettyString + parentSpaces + (isArray ? "]" : "}")


    function addToPrettyString(key) {
      let value = object[key]
      let comma = asHTML 
                ? (isArray ? ',&nbsp;' : ',&nbsp;"')
                : (isArray ? ', ' : ', "')
      let colon = isArray ? ':' : '":'
      let padSpaces = asHTML ? "&nbsp;" : " "

      if (value && typeof value === "object") {
        value = prettify(value, asHTML, padding + 2)

      } else {
        if (typeof value === "string") {
          value = '"' + value + '"'
        }

        let total = maxLength - key.length

        for ( let ii = 0; ii < total; ii += 1 ) {
          padSpaces += asHTML ? "&nbsp;" : " "
        }
      }

      if (firstLine) {
        comma = asHTML
              ? (isArray ? '&nbsp;&nbsp;' : '&nbsp;&nbsp;"')
              : (isArray ? '  ' : '  "')
        firstLine = false
      }

      prettyString += parentSpaces
                    + comma
                    + key
                    + colon
                    + padSpaces
                    + value
                    + (asHTML ? "<br />" : "\n")
    }
  }
  
})(window.lexogram)