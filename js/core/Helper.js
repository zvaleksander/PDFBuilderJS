var helper = {};

helper = (function(){
	// Universo de tags
	var Label = {			
		ROOT     : 'XMLToPDF',
		GROUP    : 'group',
		TEXT     : 'text',
		SOURCE   : 'source',
		CELL 	 : 'cell',
		COLUMN   : 'column',
		WATERMARK: 'watermark'
	};

	// Universo de propiedades
	var Property = {
		TYPE 		  : 'type',
		NUMBER_COLUMNS: 'number-columns',
		ROW 	 	  : 'row',
		COLUMN 	 	  : 'column',
		COLUMN_SPAN   : 'column-span',
		BORDER 	  	  : 'border',
		ALIGNMENT 	  : 'alignment',
		FONT_FAMILY   : 'font-family',
		FONT_COLOR 	  : 'font-color',
		FONT_STYLE 	  : 'font-style',
		FONT_SIZE 	  : 'font-size',
		BACKGROUND 	  : 'background-color',
		HEADER 		  : 'header',
		NAME 		  : 'name',
		DATA 		  : 'data',
		SCALE 		  : 'scale'
	};

	// Universo de tipos
	var Type = {
		TEXT 	 : 'text',
		IMAGE 	 : 'image',
		TABLE 	 : 'table',
		DATATABLE: 'datatable',
		QR_CODE  : 'qrcode'
	};

	var Token = function(type, value) {
   		this.type  = type;
   		this.value = value
	}

	var tokenize = function(object, str) {
		var result = [];
		var letterBuffer = [];
		var numberBuffer = [];
		var expression = '';

		var emptyLetterBuffer = function () {
			if(letterBuffer.length) {
  				result.push(new Token("VARIABLE", letterBuffer.join("")));
  				letterBuffer = [];
  			}
  		}

  		var emptyNumberBuffer = function () {
  			if(numberBuffer.length) {
  				result.push(new Token("LITERAL", numberBuffer.join("")));
  				numberBuffer = [];
  			}
  		}

		var validate = {
			'IS_UNDERSCORE': function (character) { return (character == '_'); },
			'IS_SEPARATOR': function (character) { return (character == '|' || character == ':'); },
			'IS_MUSTACHE'  : function (character) { return (character == '{' || character == '}'); },
			'IS_DIGIT'     : function (character) { return /\d/.test(character); },
			'IS_LETTER'    : function (character) { return /[a-z]/i.test(character); },
			'IS_OPERATOR'  : function (character) { return /\+|-|\*|\/|\^/.test(character); },
			'IS_LEFTPAR'   : function (character) { return (character == '('); },
			'IS_RIGHTPAR'  : function (character) { return (character == ')'); },
		} 
  
  		str.replace(/\s+/g, "");
  		str = str.split("");
		str.forEach(function (char, idx) {
    		if (validate['IS_DIGIT'](char)) 
    			numberBuffer.push(char);
    		else if (char == '.')
    			numberBuffer.push(char);
    		else if (validate['IS_LETTER'](char) || validate['IS_MUSTACHE'](char) || validate['IS_UNDERSCORE'](char)) {
    			if (numberBuffer.length) 
    				emptyNumberBuffer();

    			letterBuffer.push(char);
    		}
    		else if (validate['IS_OPERATOR'](char)) {
    			emptyNumberBuffer();
				emptyLetterBuffer();
				result.push(new Token("OPERADOR", char));
    		}
    		else if (validate['IS_SEPARATOR'](char)) {
    			emptyNumberBuffer();
				emptyLetterBuffer();
				result.push(new Token("SEPARADOR", char));
    		}
    		else if (validate['IS_LEFTPAR'](char)) {
    			if (numberBuffer.length)
					emptyNumberBuffer();

				result.push(new Token("LPARENTESIS", char));
    		}
    		else if (validate['IS_RIGHTPAR'](char)) {
    			emptyLetterBuffer();
				emptyNumberBuffer();
				result.push(new Token("RPARENTESIS", char));
    		}
  		});

		if (numberBuffer.length) emptyNumberBuffer();
		if (letterBuffer.length) emptyLetterBuffer();

		var isAritmethicExpression = true;
		for (var index = 0; index < result.length; index++) {
			var type = result[index].type;
			var value = (result[index].value).replace('{{', '').replace('}}', '');
			if(type == 'VARIABLE') {
				if(object != null && object.hasOwnProperty(value)) {
					if(isNaN(object[value].toString())) isAritmethicExpression = false;
					result[index].value = object[value].toString();
				}
			}
			expression += result[index].value;
		}

		if(result.length > 1 && isAritmethicExpression)
			return nerdamer(expression).text();
  
  		return expression;
	}

	var replaceVariableAsNumber = function(object, value) {
		var data = object[value].toString();
		if(!isNaN(data)) return true;

		return false;
	}

	var getAttributes = function(atts) {
		var instance = {};
		instance.type 	    = 'text';
		instance.row  	    = 0;
		instance.col  	    = 0;
		instance.colspan    = 1;
		instance.columns    = 1;
		instance.fontcolor  = '#000000';
		instance.fontstyle  = 1;
		instance.fontsize   = 11;
		instance.alignment  = 1;
		instance.border     = 15;
		instance.background = '#FFFFFF';
		instance.header     = '';
		instance.name 		= '';
		instance.data 		= '';

		// Campos auxiliares
		instance.aux_1		= null;		// Auxiliar string
		instance.aux_2		= null;		// Auxiliar entero
		instance.aux_3 		= null;		// Auxiliar doble

		if(typeof(atts) != 'undefined') {
			for(var index = 0; index < atts.length; index++) {
				if(atts[index].nodeName == Property.TYPE) instance.type = atts[index].nodeValue;
				else if(atts[index].nodeName == Property.ROW) instance.row = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.COLUMN) instance.col = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.COLUMN_SPAN) instance.colspan = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.NUMBER_COLUMNS) instance.columns = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.FONT_COLOR) instance.fontcolor = atts[index].nodeValue;
				else if(atts[index].nodeName == Property.FONT_STYLE) instance.fontstyle = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.FONT_SIZE) instance.fontsize = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.ALIGNMENT) instance.alignment = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.BORDER) instance.border = parseInt(atts[index].nodeValue);
				else if(atts[index].nodeName == Property.BACKGROUND) instance.background = atts[index].nodeValue;
				else if(atts[index].nodeName == Property.HEADER) instance.header = atts[index].nodeValue;
				else if(atts[index].nodeName == Property.NAME) instance.name = atts[index].nodeValue;
				else if(atts[index].nodeName == Property.DATA) instance.data = atts[index].nodeValue;
			}
		}

		return instance;
	}

	var getCell = function(data, row, col, colspan, atts) {

		var cell = {};

		cell.data 	 = data;
		cell.row     = parseInt(row);
		cell.col     = parseInt(col);
		cell.colspan = parseInt(colspan);

		return cell;
	}

	var calculateWidths = function(colspanArray, maxColums) {
		// Obtiene el ancho (%) que cada columna de la fila 'x' ocupará.
		var widths = [];
		if(typeof(colspanArray) != 'undefined') {
			for(var index = 0; index < colspanArray.length; index++)
				widths.push((colspanArray[index] * 100 / maxColums) + '%');

			return widths;
		}

		return widths;
	}

	return {
		tokenize: tokenize,
		getCell: getCell,
		getAttributes: getAttributes,
		calculateWidths: calculateWidths,
		Label: Label,
		Type: Type,
		Property: Property
	}
}());