var builder = {};

builder = (function () {
	var path = 'http:\\\\localhost:80\\PDFBuilder\\resource\\input.xml';
	var xml = null;			// Documento XML
	var body = [];			// Arreglo de celdas (contenido XML)
	var pdf = [];			// Contenido del documento PDF
	var maxColumns = 0;		// Cantidad máxima de columnas del documento PDF
	var dto = {};			// DTO contenedor de la información con la que se construirá el documento PDF

	var qr = new QRious({
	  	background: 'white',
		backgroundAlpha: 1,
	  	foreground: 'black',
	  	foregroundAlpha: 1,
	  	level: 'Q',
	  	padding: 4,
	  	size: 227
	});

	var pageOrientation = 'landscape'; // portrait
	var pageSize = 'A4';
	const MARGIN = 20;		// Margen por defecto
	const SIZE_A4 = { width: 595.28, height: 841.89 };
	const SIZE_A5 = { width: 419.53, height: 595.28 };

	var btnDownload = $('#btn_download');
  	
	var init = function(object, size, orientation) {
		if(size != 'A4' && size != 'A5') console.error('Page size allowed => [A4, A5]. Default value => [A4]');
		else pageSize = size;

		if(orientation != 'portrait' && orientation != 'landscape') console.error('Page orientation allowed => [portrait, landscape]. Default value => [landscape]');
		else pageOrientation = orientation;

		dto = object;
		btnDownload.click(load);

		parseXML();
	}
	
	var load = function() {
		if(pdf.length > 0) {
  			var dd = {
			    header: 
			    {
			        table: {
			                widths: ['*', '*'],
			                body: 
			                [
			                    ['Columna 1', 'Columna 2']
			                ]
			            }
			    },
			    footer: 
			    {
			        table: {
			                widths: ['*', '*'],
			                body: 
			                [
			                    ['Columna 1', 'Columna 2']
			                ]
			            }
			    },
			    content: 
			    [
			        {
			            table: {
			                widths: ['*', '*'],
			                body: 
			                [
			                    ['Columna 1', 'Columna 2']
			                ]
			            }
			        }
			    ],
			    pageSize: 'LETTER'
			};

			// Clonamos el objeto pues este es modificado una vez es procesado por la librería PDFMake
  			var tmp = JSON.parse(JSON.stringify(pdf));

  			var definition = {};
			definition.content = tmp;
			definition.watermark = { text: 'SFU', color: 'blue', opacity: 0.1, bold: true, size: { fontSize: 50 } };
			definition.pageOrientation = pageOrientation;
			definition.pageSize = pageSize;
			definition.pageMargins = MARGIN;
			pdfMake.createPdf(definition).open();
			console.log('load...');
		}
	}
	
	var parseXML = function() {
		/*
		 | Se instancia un objeto XMLHttpRequest.
		 | Despues se abre una nueva solicitud, especificando que una solicitud GET 
		 | se utilizará para extraer la data, y que la operación debe ser asíncrona.
		 | Se verifica el codigo de estatus despues de que la transacción se completa.  
		 | Si el resultado es 200 (código HTTP = OK) se procesa el archivo.
		 */
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				xml = xhttp.responseXML;

				var root = xml.getElementsByTagName(helper.Label.ROOT)[0];
				var attributes = helper.getAttributes(root.attributes);

				maxColumns = attributes.columns;
				
				var groups = xml.getElementsByTagName(helper.Label.GROUP);
				for(var index = 0; index < groups.length; index++)
					body.push(buildGroup(groups[index]));

				body = normalizeContent(maxColumns);

				for(var x = 0; x < body.length; x++) {

					var cell = body[x];
					var columns = [];
					for(var y = 0; y < cell.length; y++) columns.push(cell[y].data);
					
					var row = {};
					row.columns = columns;

					pdf.push(row);
				}
			}
		};
		
		xhttp.open("GET", path, true);
		xhttp.send();
	}
	
	var buildGroup = function(group) {
		var children = group.children;
		var parentatts = helper.getAttributes(group.attributes);
		var data = {};
		var text = '';

		var cell = helper.getCell(' ', parentatts.row, parentatts.col, parentatts.colspan, parentatts);

		// Variables utilizadas para construir 'tables' y 'datatables'
		var content = {};
		var table = {};
		var widths = ['*'];		// Almacena el ancho de cada columna de la tabla
		var body = [];			// Almacena todo el contenido de la tabla
		var row = [];			// Almacena las filas de la tabla
		var sumColspan = 0;		// Calcula la cantidad de celdas que ocupan los componentes, si llegan a ser igual al límite se pasa a una nueva fila
		
		if(parentatts.columns)
			for(var index = 0; index < parentatts.columns - 1; index++) widths.push('*');

		if(parentatts.type == helper.Type.TEXT) {
			for(var index = 0; index < children.length; index++) {
				var node = children[index];
				
				if(!node.textContent.trim().includes('{{'))
					text += node.textContent.trim() + '\n';
				else
					text += helper.tokenize(dto, node.textContent.trim()) + '\n';
			}
			data = createText(text, parentatts);
			row.push(data);
			body.push(row);
		}
		else if(parentatts.type == helper.Type.IMAGE) {
			for(var index = 0; index < children.length; index++) {
				var node = children[index];
				
				if(!node.textContent.trim().includes('{{'))
					text = node.textContent.trim();
				else
					text = helper.tokenize(dto, node.textContent.trim());
			}
			data = createImage(text, parentatts.colspan);
		}
		else if(parentatts.type == helper.Type.TABLE) {
			for(var index = 0; index < children.length; index++) {
				var node = children[index];
				var childatts = helper.getAttributes(node.attributes);

				if(!node.textContent.trim().includes('{{'))
					text = node.textContent.trim();
				else
					text = helper.tokenize(dto, node.textContent.trim());

				data = createText(text, childatts);
				data.colSpan = childatts.colspan;		// Agrego propiedad 'colspan'

				sumColspan += childatts.colspan;

				row.push(data);

				if(childatts.colspan > 1)	// Completo con celdas vacías para hacer valer la propiedad colspan
					for (var x = 0; x < childatts.colspan - 1; x++) row.push(createEmpty());

				if(sumColspan == parentatts.columns) {		// Inicio de nueva fila
					sumColspan = 0;
					body.push(row);							// Inserto nueva fila
					row = [];								// Reinicio buffer de columnas
				}
			}
		}
		else if(parentatts.type == helper.Type.DATATABLE) {
			var childattsCollection = [];
			for(var index = 0; index < children.length; index++) {
				var node = children[index];
				var childatts = helper.getAttributes(node.attributes);
				childatts.aux_1 = node.textContent.trim();		// Almaceno la propiedad con la que se poblará la tabla

				data = createText(childatts.header.trim(), childatts);
				data.colSpan = childatts.colspan;		// Agrego propiedad 'colspan'

				row.push(data);
				childattsCollection.push(childatts);

				if(childatts.colspan > 1)	// Completo con celdas vacías para hacer valer la propiedad colspan
					for (var x = 0; x < childatts.colspan - 1; x++) row.push(createEmpty());
			}
			body.push(row);							// Inserto nueva fila
			row = [];								// Reinicio buffer de columnas

			// Completo tabla con datos del objeto de entrada
			if(dto != null && dto.hasOwnProperty(parentatts.data)) {
				var collection = [];
				collection = dto[parentatts.data];
				
				for(var x = 0; x < collection.length; x++) {
					var item = collection[x];

					for(var y = 0; y < childattsCollection.length; y++) {
						var childatts = childattsCollection[y];

						text = helper.tokenize(item, childatts.aux_1);
						
						data = createText(text, childatts);
						data.colSpan = childatts.colspan;		// Agrego propiedad 'colspan'

						row.push(data);

						if(childatts.colspan > 1) {	// Completo con celdas vacías para hacer valer la propiedad colspan
							for (var z = 0; z < childatts.colspan - 1; z++) row.push(createEmpty());
						}

						if(childatts.name != '') childattsCollection[y].aux_2 += parseFloat(text);
					}
					body.push(row);							// Inserto nueva fila
					row = [];
				}

				for(var y = 0; y < childattsCollection.length; y++) {
					var childatts = childattsCollection[y];
					if(childatts.name != '') dto[childatts.name] = childatts.aux_2;
				}
			}
		}
		else if(parentatts.type == helper.Type.QR_CODE) {
			for(var index = 0; index < children.length; index++) {
				var node = children[index];
				console.log(node.textContent.trim());	
				if(!node.textContent.trim().includes('{{'))
					text = node.textContent.trim() + '\n';
				else
					text = helper.tokenize(dto, node.textContent.trim());
			}
			console.log(text);
			qr.value = text;
			data = createImage(qr.toDataURL(), parentatts.colspan, [226, 227]);
			cell.data = data;
		}

		if(parentatts.type != helper.Type.IMAGE && parentatts.type != helper.Type.QR_CODE) {
			table.widths = widths;
			table.body = body;
			table.margin = [ 5, 0, 5, 0 ];

			content.table = table;
			content.width = (cell.colspan * 100 / maxColumns) + '%';

			cell.data = content;
		}
		else
			cell.data = data;
		
		return cell;
	}

	var createText = function(text, atts) {
		var data = {};
		data.text = text;
		data.fontSize = atts.fontsize;
		data.color = atts.fontcolor;
		data.width = '*';
		// data.width = (atts.colspan * 100 / maxColumns) + '%';
		data.fillColor = atts.background;
		data.margin = [ 0, 1.5, 0, 1.5 ];

		switch(atts.fontstyle) {
			case 1: 
				data.bold = true;
				break;
			case 2: 
				data.italics = true;
				break;
			case 4: 
				data.decoration = 'underline';
				break;
			case 5: 
				data.decoration = 'lineThrough';
				break;
		}

		switch(atts.alignment) {
			case 0: 
				data.alignment = 'left';
				break;
			case 1: 
				data.alignment = 'center';
				break;
			case 2: 
				data.alignment = 'right';
				break;
		}

		// RIGHT - TOP - LEFT - BOT
		switch(atts.border) {
			case 0:
				data.border = [false, false, false, false];
				break;
			case 1: 
				data.border = [false, true, false, false];
				break;
			case 2: 
				data.border = [false, false, false, true];
				break;
			case 3:
				data.border = [false, true, false, true];
				break;
			case 4:
				data.border = [true, false, false, false];
				break;
			case 5: 
				data.border = [true, true, false, false];
				break;
			case 6:
				data.border = [true, false, false, true];
				break;
			case 7:
				data.border = [true, true, false, true];
				break;
			case 8: 
				data.border = [false, false, true, false];
				break;
			case 9:
				data.border = [false, true, true, false];
				break;
			case 10:
				data.border = [false, false, true, true];
				break;
			case 11:
				data.border = [false, true, true, true];
				break;
			case 12:
				data.border = [true, false, false, true];
				break;
			case 13:
				data.border = [true, true, false, true];
				break;
			case 14:
				data.border = [true, false, true, true];
				break;
			case 15:
				data.border = [true, true, true, true];
				break;
		}

		return data;
	}

	var createEmpty = function(colspan) {
		var data = {};
		data.text = ' ';
		data.width = '*';

		return data;
	}

	var createEmptyArray = function(colspan) {
		var array = [];
		if(colspan > 1)
			for (var index = 0; index < colspan - 1; index++) array.push(createEmpty());

		return array;
	}

	var createImage = function(byteData, colspan, fit) {
		var data = {};
		data.image = byteData;

		var widthPercentage = (colspan * 100 / maxColumns);
		var widthRectangle = 0;

		var x = SIZE_A4.width - MARGIN;
		var y = SIZE_A4.height - MARGIN;

		if(pageSize == 'A5') {
			x = SIZE_A5.width - MARGIN;
			y = SIZE_A5.height - MARGIN;
		}
		if(pageOrientation == 'landscape') widthRectangle = (y * widthPercentage / 100);
		else widthRectangle = (x * widthPercentage / 100);

		data.width = widthPercentage + '%';

		if(typeof(fit) == 'undefined')
			data.fit = [widthRectangle, widthRectangle];
		else
			data.fit = fit;

		return data;
	}

	var normalizeContent = function(maxColumns) {
		var matrix = [];	// Almacena el contenido del documento en forma de matriz
		var row    = 0;
		var result = [];
		var emptyCell = {};

		var anterior = helper.getCell(' ', 0, 0, 0);

		var rowDifference = 0;
		var colDifference = 0;
		var total = 0;			// Almacena el total de columnas recorridas, una vez llegue a su tope (maxColumns) se reinicia

		for(var index = 0; index < body.length; index++) {

			var actual = helper.getCell(body[index].data, body[index].row, body[index].col, body[index].colspan);

			rowDifference = actual.row - anterior.row;
			colDifference = actual.col - anterior.col;

			if(rowDifference == 0) {
				if(colDifference == 0) {		// Celda en la posición (0, 0)
					result.push(actual);
					total += actual.colspan;
				}
				else {
					if(anterior.col + anterior.colspan < actual.col) {		// Completa con celdas vacías a nivel de columnas
						emptyCell = helper.getCell(createEmpty(actual.col - (anterior.col + anterior.colspan)), anterior.row, anterior.col + anterior.colspan, actual.col - (anterior.col + anterior.colspan));
						result.push(emptyCell);
						total += actual.col - (anterior.col + anterior.colspan);
					}
					result.push(actual);
					total += actual.colspan;
				}
				// Actualiza la celda anterior con los valores de la celda actual
				anterior.row = actual.row;
				anterior.col = actual.col;
				anterior.colspan = actual.colspan;
			}
			else {
				if(total < maxColumns) {
					emptyCell = helper.getCell(createEmpty(maxColumns - total), anterior.row, anterior.col + anterior.colspan, maxColumns - total);
					result.push(emptyCell);
				}
				
				matrix[row] = result;
				result = [];
				row += 1;

				// Reinicio de nueva fila
				anterior.row += 1;
				anterior.col = 0;
				anterior.colspan = 0;
				total = 0;

				// Reinicio de índice para insertar filas vacías
				index--;
			}
		}

		if(maxColumns > total) {
			emptyCell = helper.getCell(createEmpty(maxColumns - total), anterior.row, total, maxColumns - total);
			result.push(emptyCell);
		}

		matrix[row] = result;

		return matrix;
	}
  
	return {
		init: init
	}
}());	

$(document).ready(function() {
	// Test
	// Cabecera
	var comprobante = {};
	comprobante.denominacion = 'SFU LA SALLE';
	comprobante.direccion_fiscal = 'CALLE LOS GIRASOLES MZ. C LT. 15';
	comprobante.ruc = '73037079108';
	comprobante.serie = 'B002';
	comprobante.correlativo = '142962';
	comprobante.fecha_emision = '2017-09-12';
	comprobante.fecha_recepcion = '03 de Noviembre, 2017';
	comprobante.moneda = 'PEN';
	comprobante.observacion = 'Comprobante afecto a detracción';
	comprobante.tipo_comprobante = '03';
	comprobante.monto_igv = 18.81;
	comprobante.tipo_doc_adquiriente = 1;
	comprobante.num_doc_adquiriente = '47546977';
	comprobante.logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAACa1JREFUeJztnXuMXUUdxz+7XbrW3UJZhUJLYbGgKYZShCJSaFEESoxE5aEIqDFGozH6D8FXUOOTGI3xQSCpKI8AJlQxRAElW0uLoAGhrlrUVmhppbUPKCy1r917/eN3795zZ8/znjkzc+6ZT/Jr95577jm/O/O9c86Z+c1veuhOeoCjgWMa/78eOBIYBAaAfmA60NvYvwYcBPYDe4Ex4CVgN7AT2A7sAOrGvoEhemw7kJMBYBFwGnAK8EbgDcA8pIJ1chDYAmwCNgL/BP4KPAns0XwuTwQzgEuBHwGjwATyq7RpNUQENwDDhX3zirMMuBtpnm1XeJxNAPcBpxdTDNVjKfA49iu2k1bhVuS+w9MB04GbkIK0XZl5bCtwjuay6XpmACPYrzxddgC4UmsJdTk/x36l6bZx4DKdhdStXIn9yirK9gNv0VdUenCpH6AHeAZ4U4p9dyOPgePAAuC4Av3SyQZgISIGj8JSkn9F24GrgGnKZy8A1qf4vAv2lZzl1LXcSHzBPQ8cH/P5QeCxhGO4YC8DszoqoS5nNfEFtyzFMY7D/c6iOvCpbEVTDbYTXWB/yHCcW2KO44qtyvB9CqU3eRcj9CGjdlFkKbCRnL6YYAn6B6s6whUBzCL+iWRnhmPtyOmLCaYDJ9l2AtwRwGsS3p+d4VjH5HHEIMfadgDcEYD6WKdyYYZjXZTHEYMM2HYA3BFAUofUYuDiFMeZD3wwvztGcKLsnXAiJbcjET9RDAErSb6ceAKUSQCzgT8hz9DB5rMPuAJ4CgkP85SQYbI9R+8HngaeAF7J+FlX7D06Ci4vfbYd6JB+/K9dC2W6BHgKwAug4ngBVBwvgIrjBVBxXHkKmEDCvGxwJBX+IbgigC3IBE4bbAXmWjq3dSqrfI/gBVBxdF8CpiPN6RDSW1cGgTkRmQOcRXpfasD/gG3Af/OcNK8ABoB3AZcAZyOjdWWodBe5n2yBL01eBB4B7gV+iUxFK5z5SPDlGPYHVcpq6mBQXFBsWtsCfGhqdeljJvAD4JAGZ6tuRQigafch8yS0shj4t0Ynq25FCqCODJUfQQJpr9eXA2uQ/DuecnAm8CsS7vPSCOD9yJRtH2pVPs4Hvha3Q5IAlgB3kBy163GX64Ezot6ME8DrkEcLV56TPZ0xDfh+1JtxAvghjkxe8OTmPOCdYW9ECWAJ5Ymv96TjurCNUQKIvXHwlJKLCHmKCxPAIuAdhbvjMU0PcI26MUwAHy3eF48lLlc3qALowee0M8Uh5bWJ4JxTUfIZqwI4nc5GpDzZGVNeH27ovG2zp1UB+Gu/OTYF/h4CDjN03rY6VgVwniEnqs4eZOi2yQKD526rY1UAbzPoSJVZjYzYNXmrwXPPIXAfEBTAicBRBh2pMiuV16G9dAUyKbigAM407ERV2YUEbDQZQjKdmmRx84+gAPx0azN8DwnobHIN5gfcQpNW34/9KJlutw1ItHSTw4DNFvyYnIUVbAFM3olWkUPA1bRH7X6S+PzHRTGEkk6vD0m9bvsX0s32EaUSjkUSR9vyZxm0WoDj8VE/RVFDfum3Bbb1AndirvcvjPnQ6n8uy4ILZWMXcC3wkLL9m5i/81c5AVotgO//18sE8DNkNVO18j8DfN64R1OZC60WwK9vp4cXkAjqW5A7fpUvAd8w6lE0s6ElAJvXok7YhiwRswUZVTtoyY9DSJ7CTcA6ZM2jMAaBFcAHzLiViiFoCaAMkb9/RG6cfovMUCoLlyCLYJ5o2xGFmcEXN2D/MSnMaki/eRl7Kc8Ffof9MoyyDdBqASYKKIC8PAN8Alhr25GU9CJdrBcjEdWn2HUnkb7Jf3BvHbufAp8G9oW814tELp0FnIysNmLrEtaHTMCcg+RGKNP0uXFoCeAVi46ofA74Tsj2ecgj1LX4x1YdtCWSeB/2r0l1pIJVBoDvNhy27V832ePQagG2hxS8aW5EpqMFWQj8AkcWWOoy2vIyzsOuGkeYGp72dnwKmiJtBYFC/w/2OlNeRUbKaoFtZwO/poA0J55JNkNLADXgWUuOfJ32CNnZSGaL19pxpzJshPZmN6obs0h2AD9Wtq3A3+Wb4O/QLoBRC07cTHt83HLg3Rb8qBr7afzggwJYZ9iJOjJkGuTLhn2oKn+m0REUFMCThp1YR+NGpMFC/MQUU0x2rwcFsBUZzzaFusr3FQbPXXUebv6hPns/ZtCJvyiv/cRUM4wBjzZfqAJ4FHOoETOnGjx3lXmQQJ+PKoDVBh3ZE/h7FkqAgqcw7g2+UAUwirlxgb2Bv33lm2EM+E1wgyqAOjJFzDR+ToIZVqLEWIQlibrLjC8eC6j9LqECWEN4SLOn3KwnJLwuKlFkZG5ZT2lRYy1i6af4acvB6WjDBZ+r6rYNmEEIUS3AAeALEe95yse3CQ+wTeQBfAtQdvsHMSnokhaM+DASLeQpJzXgY0zNSjpJkgB2IusCuhQ27knPV9HUvX8GEr3jLwHlsZ8guZ+1MQ95jvQCcNtqwLfQXPlNepAIXh3rB3oB6LdRDA2rT0OyTt+MBBce7MBZL4D8Ng78C2nuL6SDdZt1NRPTkDSzg6TPe7+RRlwaIoDnNPmSlfPJuQK3BWrIaOpO7M3n0Mow9n5FlU6Q5Zd6rzheABXHC0Cmpdm49Kirh1vBC6DieAFUHC+AiuMFUHG8ACqOF0DFMbFcaTezC3ga6dJegLIsqyc9w9gfWMliLyBrLKsTWs5FBFGafgBXGMZ+paa152jk2o9gBrAqxXGcEIC/B8jO1cTHSe5D0sK/bMadfLgigFryLk6wlnQ5FHYQMg1LwYnv7IoA9ibv4gS/17ivuny8FVwRwIuUQwS7k3dJva/JdDyRuCKAOnbS1GVlToZ9424U99FI1GgbVwQAU1fXcpHlmvZdhZuLdFhlGCkU2495SfbeFN/lZCQZY9QxrspWNNXhDuxXcJLtBk6L+Q5HIZezqM8/SzkW6bLCXOAl7Fdykr0KXE/7eov9SB/B1oTPpmlBKs1lyDOy7UpOY+PI7NtRJOdx0v63aiynruY67FeubhvBN/2Z+CzluClMYw8QkaHDE89yZNaO7Qrs1CaQiZo+DV4Ojgbuxn5lZrW/IcPDHk0sAR7BfsUm2fPAx/HBNoVxDnAP7q0juAbp4PEVb4ghZG3hh+lsenpeqwFPAF8E5hf8XQujkCwSFpiJrDN4AbAUST2v+8arjszFX4sM9Y5QvmnlU+gWAagMIgtMLwLejCzsfALS09if8NkDSGLFzUjK3PXI4hZP0Z7ivivoVgHEcTjShTuAdMzUkUvIXiSMqxShXLr4PwFdt1eGjQ7tAAAAAElFTkSuQmCC";
	// comprobante.logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOIAAADiCAYAAABTEBvXAAASNUlEQVR4Xu2d23bbOgxEm///6J7lnCaOLxTALYChk91XESQ4mAFAKnLf/vz58/fPC//7+/e5+29vb8NdjWwuBh12R/Ae+bIyLEf7pn4QnCkeHf7TfRO7C1sV4hfkFCKh0XMbhZjHUiHeYaUQ8+SJRirECKHrc4WoEN8R6GjtFKJCbDnrEWJFoaBnomje2ecKcRax2vFWRCuiFbFWU2i2oRB3ydRR27STn6MIrDx30qpN7apvhDuw2oUjR3tTiCh/zRl1kGvkARUUtVOIeS4oxDxWLSMVYh7WDqysiHn8D0fS4BQtf3oa6j+5QKGVjdpZEfP0sCLmsWoZqRDzsHZgZUXM429FfIKAFfEWFFq1FaJCDF8NUHJ5WXOLAK2kRRRNTVPempJMHXlKCblLtov2V/l8Nek64k0SyRGGFJOOvZEPEdDri5XOX8CnIFeSf6e5VuPREW+FeFfRR19f0ApFCUvXsyLmz1E0NgpxDjkr4hxeLzvaivgYOopJR5JRiC8rrTnHKenmVrmO7iCrramtKeXjNnYK0YoYXsdTtnpGzCOnEBXijxBiR6vVkUiInx1+7PLaoGNvBOMoZXpGjBD693wl+GdevxA/O8iqEJPE+jdMISbxIgSPpu4QAPGzww+FGEU/9wrJv6y5w5EQPApFhwCInx1+KMQo+grxD3mhTwgehaJDAMTPDj8UYhR9hagQ7ziiEB9FQzGZk991tGfEJHKk0kRT02BTu5E/dD7SWfyEi6iVXPiVZ0QKcAeRqS+R+J89p4Ki7Sfx8WJT7Sd9t9oRGyviF1ZQgBXio7QolkciVYi36PzYz6AoeRSiQqRV/sPOimhFLG/5onMgJa0V0Yp4yB0rohWRJhcr4hPkbE3P0ulqT7H0jHhX9Q7+z07PiHdssSJaEc+msGVnxLOOztqTq+mOLL4ywx+dzWiymMU9arW6zo8jP+m+q8+jFMfy94jUEWqnEG+Ro4Sk+K9eTyF+QWCXLBJlXdIGUEJaEde0rQpRIWKNdiSuUSewukKtXk8hKkSF+AQBhYhpcWPoGbEGx8NZrIj9INOE0BEbsluFSFCbtOkItq1pzSVVR2wm6fE+HAmRLPQdNuSypiOzkpvdKDjurUaI38HL2TWHL/RnJ/qu8ZK1hqy7JKeOhPZd3JxZVyHeodVBhGqSv4KPO1X7GUF811iFqBDfEahOFgpxTtIKUSEqxDnNtIxWiApRIbZIa25ShagQFeKcZlpGv/3d5SVLy/aeT7rTZcfRtlfeCHfAT86dv5CO79ArxDsGEvKcuexQiLcIKMSOlLjpnFbENYEhSU0hronNFqsoxDVhUIh5nG1NbU3zbJkcqRDzgClEhZhny+RIhZgHbCjE1b/5knc5N5KQIDfz81Er11u5VnQRdYRZNYfo+ZH6QdcbYXL49cXo9QV1/gyZK213Ims1ljvtTSHmWasQ77CqFkZUNarXU4h58l9GUvytiHM4Px29E1kpEUYw7LQ3K2KerFZEK2KeLU9G0sqwMgF1JAS6b8+IXxDYqWqsJGT1WlHb3SEA0gl0+KEQT+Xv/40VYgGI/6aghKxOCqv9oOuhinjh7DPDnYhcne0owNXEolJZHZsjP1diSfe90sejIoB+PIpuuoNcCvEWgdWxUYhzrB7FRyHe4bg6Q86FMR6tEB8xon8/XJ3krYgxfz9HKMQJsIKhK7GkCWiljwpxglurAzPhWmooJWRq8slBK7Gk+17po0KcINDqwEy4lhpKCZmafHLQSizpvlf6qBAnCLQ6MBOupYZSQqYmnxy0Eku675U+biPEDrDIa4MO8Omc1RcCHRhP6i81vPoChfDgSBiXZ9RH4sth3KrfI3aQpHrTVBgKMaW/z0GU5KNVCA8U4hM0aWBIAKhoqI9zFL2Ort7bav9XJjWClUJUiCltEnJ1dB0pZycHVScFgpVCVIgp2hJyKcQUtJ+DOvAqj5tnxNugVmfxiDLlAX27/Hj783+0XY/2QM50xBeClRXRipjiLyFXR4ZPOTs5qDqpEax+tBDpAX0yjqdbC1IZKHmo3WosaQwIlmRvpFKe2RMV95k1n9kO/xMaCkjHxmgFIOShgqJ2hKzVJDgzXzVP6Hx0Dx18Jb4oxDvUqKConUK8RUAh3jGCAtKRYayIJMeusanmCZ2P7raDr8QXK6IVkfAmdX4n1V4hWhHfEaAtJrUjZD2lnGJjKpwRXnQ+ui0r4gRytqYTYC0eSoWjEG8Dhf4Tml2yCOUcJQ9dj1bL30hWmnSpHY1p9XoKkUZiwk4h5sGiBKd2ec/yt7ukUClEGokJO4WYB4sKitrlPVOIFKuhna3pHKQkw8+tcB1NBUXtVvs5Ws+KSCMxYWdFzINFBUXt8p5ZESlWVsQi5KyIj0BWC9+KWETWo2msiHmQKcGpXd6z5oo4+h6xw8GVZKX+72Q3Ile1sC97pudm6svwrAS/p6z24+IfnZN0EMM/caOEXB1Qsmm6t9V2CrGmCr0CJxXianVNrKcQFeIEXfJg2ZrOwaoQ89yibeQunLQizmlj6WiFqBAx4V6hH8ebW2yoEBUippxCxNA9GCpEhdhynV1H0Xgm+l6pI5HE3taNoP7TsxL1vNpPentOeUL2fbgW+V3T1UEr3zR8V/Xq+yY4XmwoyY/WU4i36LzET2UQAtFMRwnSQdbqfZP5FCJF7dHOiniHyeqr7rpQxjPRRLK62lf7SRMhTdhxJBTiOwIUYEoQSgQS0JUtnxWxLkJWRCviKTZ1JBma8EYboT7ShE0AVYgKkfDm04aSfGXlpj5uI8S/xamJAkKDRn5gaRcfaQtdHLJvEeku70jpfQG1G1Z0hXiKh5/GNLMSO4X4GDMqjNV2CvELAlbEmuRz5iLHingbA/SF/k5X3bamdaIiM9GkphAV4vK/FKluf2xNbU3DpEkzpJc1eXIpxDxW9EKsy254RiS/WUMuGKKN0XaXkJJWqDALDQbQ5PQb27dqrDrOsR08QB8GK8S5UFSTiyaSV7CrxkohPuEqqV4RkGROSsg5+V1HV5OL+v8KdtVYRfyhRyLChaO9WRHvECXCjoJSTa5XEFQkANJ2U9FU4x/Fe3gOPPj8TiEqxHcEOo4bJGF0iKZjTiJGK+IdaoQgBPgPm2oiUP9fwa4aq6gy0ypL+KAQFeI7AgpxTj7VxxQkxNWtyi6ZqcMPKoA52pwbTSvRuVUfrSn5qf+U54QnCnGiIhKAIzIqxAih63OFOHFpQYnVkbXyIb6OXO0HxYvsjdpQTOh6IzuFqBBDTnWQhM4ZOjs5QCE+AkYxIa9m0K+40QxfvbFJrn0OX+0HxYvuj9hRTMhaq9t/uh7FRCEmWVENcLSsQowQ8oxoRcxzpOXXz21NbwNA8ehIrtVzHt6ajn4qgzpB24AjO1JRqP/0OpsSaCIPpFrrDj86sBztm8T6MtdOduQiaviFPgVfIRJpzdlQ0s2tch1NuUCSAt3bTnYK8QsCHeShwaYCqK4a1I8OLKv3RmPTYacQFSI+x9KjQXUH1CGMjuMGSU6HfnhGzF8WUJLQSlRdNagfhHSXtWxNJ7ilECfAavjv3Ig4VicEhfgYJYKJFXGC7R1tzMTyqaEKcU4YHTFdJkR6ZujYdIqdCwYR8Be4lV6CtIrR5BQT4ktHAqL+R7jMPkc/MEwBoXazm+oav0vQ6P4I+aO1KCbElw7+UP8jXGafK8QJxHYJ2oTLN0MJ+aO1KCbEF4V4Fw0KCLWLyLDqOSXdKv+idQj5ozkpJsSXDv5Q/yNcZp9bEScQ2yVoEy5bEQOwdompQpxg9S5Bm3BZISrERwQ6WgtKSmKnEOdieoSxrektOuW/a3oEPhVitQAICS77ov5XY0LxoPuu9p/OR4VN8aLroSRf/Z/QUJDp+0eyaUpIhThXEQnOVDQr+XNBgeztUBsKMS9lhagQPxBQiHndDEdSEBWiQlSIBQI8C6JCVIhnOTSisZc1EwJXiApRIU4IJhpqaxohlH9enZy8rLnDfvUtFL0qHgWuw/+OOem+hy3OwTeTdC0qDrpePg1cR1YnhMvM1XMezVf+c4oExMiGCIDYdPgRzVlNViqaDryq93Y0X7VoFOITtAlJiE0kmo45q8mqEB8R3eUoYkW8i81PJutP3psVsYjIUcUZPSeViNhE/nXMaUWMUM89tzXN4XRqFBEAsYmc7JhTIUao554rxBxOp0YRARCbyMmOORVihHru+a8U4k69Omlnc6GdG0WJQM50r5AQolvHOXT/H033Te1okkSv1EZ/9L3LTRMNKPWfECTysZoI1fNFe6ZYkiRTTf4zAq725TBuCjGiYe65FfERJ4V4i4lCzGnp1CiFqBA/ELA1/cIF2k5RNSpEhagQn6hHIdKU8mhHsbQ1tTUt/ymDiNZWRCviy1REegsViWDV8w6xkWpD/TjCqbp60dtKeiNMcIxuu6t5tc1ljUKsafsUYg2OCnGDMx3JdlQA1G7kY/V8XYQk1Y3YRNV3dScwWs+KSFT3xIYKgNopxFsEqnHsSkAKsUhw1QKoJlD1fF2EJNWN2FgRJ6uGZ8Sas41CrMGxKwEtq4gdN2zVxawjs9J9U19IQDvOQ/RGssOXap7sUhxe4jdrCPiU/NSOBpSImwqDrHWm7VOIeeYqxDusFGJd26cQFeLLf7tGK2wH+WkF7vAlT+3zIzv2PbwIJJ9B0RbnPDT5GWhlo3ZUOARLShCylq1pnnNnRtqa2pqG/KHCtyKG0H4OUIgKMWSLQgwhOj3g7W8HyqfdOj8BfdfW0b5RX4bniY1+Vr+aPtVYRUyi6xG7IxuFeBcphRhR9/a5QszfMivEjdtPQuTVyYJeRM1J+v/RpNKQdT5s6HrETiEqxHcEVt8IE4EQgpN1FOIZ1CZsaUBXVxsr4m1QadwmqHEzlK5H7KyIVkQr4kCpRFC0hVaIClEh7i7E0V/W0FK/2m7U2tEWc+XFREdmXe3/0XrVMaBn3NV2I0zQF/qrBUXXU4h55Mh5ND/740iFeIuJQjzDpi+2HUQmZxRK8A7/rYh5cinEPFaHIzuIrBDzwVndYtL1bE2/IECrxuozlkJUiO93BV7W1BAhP8vtSIWYR45WqNV2VkQr4vLW2jNiUSIhHwbnl64Z+QpVg/j43pIcfElRfSbdqV0nvlTjcQZ/ErfDF/oKMX/FTLN/R2tEUhwhf7QOFQfxha61S9wUYsSmglcUJEOeycgTW/ocSsgfrUPFQXyhaynEKIrJ54TkJNAXd2iwiY8KMUmAf8NobBTiHM7D0YTkCvERTorJURipOIgvdC2FqBDfEfCMWJMUFGKRoOg0VkSK3K0dqULRylQcxBe61o+tiATEMwGtFiINaMe+O9q+0Zyr/Sd728lH4n907h/Ghry+6ACrun0j4o2SRce+abAjX589X+0/2dtOPhL/FeIdagqx5lxGBJ+xWfn5Wsaf2TG0cFgRvyBgazpLu/rxCvHu/G5rmifZ6raJJgzPiPmY0pFWxDvkSGalBFeIlLaPdiRudaufn0khKkTMotWJhFx27OQj8d/LmgWXNVgB0HBEyupsfHGPdglwa8iMXsBRcVOcSbXf5n+DWrnpVyDdUWalWNEMj1TTYKQQJ6oNxZ+Si2QfhZg/s9F4dtgpRIXYwatwTlvTW4gUokIMRdMxQCEqRPzFACWkrekjcgpRISpEmlEK7RSiQvzRQizUyudU1RW9w8eOMxbd92h/9CJtl1cUNG6/8vUFBYte/1MBVPtJ/eiwU4h31f43/q1pNcEv89HKQCsA2UOHoOi+FaJCJBwObSghFeIttBQPW9OQorkB1USmgcl5+ziq2n/qx5GdFXHfuHlGLGK8Qsy/fqFnbZpk6Ho0cRFKKUSC2hMbhagQz1AJCfHMgsSWZCZiQ3z7sKGtMDkT0bVoZaCVaOXeaCI8E/PKCyeFWBQJKo6VZFWIRcEOpkExJa8v1mznugqpbsTmzL4U4txFyAjrDhzpnJQPCvELcgpxjkaEPJcVqnGmorE1nYs3Gk2CTWyQc/+MOghUXTVsTc9EOG9LkppnxDy+hyMVoq3pBwKlQiziZ/s0ZNMdTtEKTAVceWPXgQdtWykeHa0p5Rb6amZ0WdMVnOp5KVjVfijER0QJJgqxmpmL5lOIt0DvgocVca5VH54RF+no9DK7EI9k/4isBJxd8Ij2NvLTikiivoHNLsRTiLamHwh4RvzGxKAQFaJC/EYBRuBfnnfc6Hlrmj8bd7S7R5QjFfE/zuFKVbUlEVsAAAAASUVORK5CYII=";

	// Detalle
	var detalle = [];

	var linea_1 = {};
	linea_1.cantidad = 10;
	linea_1.unidad_medida = 'KG';
	linea_1.codigo = 'P01';
	linea_1.descripcion = 'descripcion 1';
	linea_1.precio_unitario = 17.5;

	var linea_2 = {};
	linea_2.cantidad = 4;
	linea_2.unidad_medida = 'LT';
	linea_2.codigo = 'P02';
	linea_2.descripcion = 'descripcion 2';
	linea_2.precio_unitario = 5;

	detalle.push(linea_1);
	detalle.push(linea_2);

	comprobante.detalle = detalle;

	builder.init(comprobante, 'A4', 'landscape');
});