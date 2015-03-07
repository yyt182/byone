/**
 * 子模式类
 */
function Clause(name) {
	this.name = name || '';
	this.filters = [];
	this.where = [];
	this.groupBys = [];
}

/**
 * 原型
 * @type {Object}
 */
Clause.prototype = {
	constructor: Clause,
	mirror: function(obj) {
		if (!obj) {
			console.log('obj is null');
			return;
		};
		this.name = obj.name || '';
		this.filters = obj.filters;
		this.where = obj.where;
		this.groupBys = obj.groupBys;
	},
	showError: function(message, title) {
		//console.log('error:'+message+' title:'+title);
		$('#errorModal')
			.find('.modal-title').text(title || 'Error!')
			.end()
			.find('.modal-body').html(message)
			.end().modal('show');
	},
	/**
	 * 对象序列化
	 * @return {Object} 序列化的对象
	 */
	serialize: function() {
		var _result = {
			name: this.name
		};
		var _clauses = ['filters', 'where', 'groupBys'];
		console.debug('serialize begin!');
		for (var i = 0, _clauseName = _clauses[0]; i <= _clauses.length; _clauseName = _clauses[++i]) {
			var _clause = this.serializeClause(_clauseName);
			if (_clause) {
				_result[_clauseName] = _clause;
			};
		}
		return _result;
	},
	/**
	 * 序列化从句，装配顺序：关系、左括号、属性、操作符、值、右括号。
	 * @param  {String} clause 从句类型(filters, where, group)
	 * @return {String}        序列化从句
	 */
	serializeClause: function(clause) {
		var _clauseArr = this[clause] || null;
		if (!_clauseArr || _clauseArr.length <= 0) { //没有此类从句则返回
			return null;
		};
		var _result = '';
		for (var i = 0, clause = _clauseArr[0]; i < _clauseArr.length; clause = _clauseArr[++i]) {
			//关系，第一行除外
			if (i != 0) {
				_result += getVal(clause.relation);
			};
			_result += getBrackets(getVal(clause.leftBracket), true);
			_result += getVal(clause.attribute);
			_result += getVal(clause.operator);
			_result += getVal(clause.value);
			_result += getBrackets(getVal(clause.rightBracket), false);
		};

		function getVal(str) {
			return str ? str + ' ' : '';
		}

		function getBrackets(count, isLeft) {
			var _bracket = isLeft ? '(' : ')';
			var _brackets = '';
			while (count--) _brackets += _bracket;
			return _brackets ? _brackets + ' ' : '';
		}
		return _result;
	},
	/**
	 * 填充数据
	 * @param  {[type]} filter  filter选择器
	 * @param  {[type]} where   where选择器
	 * @param  {[type]} groupBy groupBy选择器
	 * @return {[type]}
	 */
	loadFromForm: function(filter, where, groupBy) {
		//console.debug('load');
		var _clause = {};
		if (filter && !(_clause = this.loadClause(filter, '过滤条件'))) return false;
		this.filters = _clause && _clause.length > 0 ? _clause : null;
		_clause = null;
		if (where && !(_clause = this.loadClause(where, '聚合条件'))) return false;
		this.where = _clause && _clause.length > 0 ? _clause : null;
		_clause = null;
		if (groupBy && !(_clause = this.loadClause(groupBy, '分组方式', true))) return false;
		this.groupBys = _clause && _clause.length > 0 ? _clause : null;
		return true;
	},
	/**
	 * 获取对象数组
	 * @param  {String | JQuery Object} placeholder   容器
	 * @param  {String} clauseType    数据类型
	 * @param  {boolean} ignoreBrackets 是否不检查括弧
	 * @return {[type]}               [description]
	 */
	loadClause: function(placeholder, clauseType, ignoreBrackets) {
		var $clauses = $('.clause', placeholder).not('.template');
		var _clauses = [];
		for (var i = 0, $clause = $clauses[0]; i < $clauses.length; $clause = $clauses[++i]) {
			var _filterObj = this.getObj($clause, i == 0, clauseType);
			if (!_filterObj)
				return false;
			if (_filterObj == 'empty')
				$clause.remove();
			else
				_clauses.push(_filterObj);
		};
		if (_clauses.length == 0) return true;
		return (ignoreBrackets || this.checkBrackets(_clauses, clauseType)) && _clauses;
	},
	getObj: function(placeholder, isFirst, clauseType) {
		var $tds = $('td', placeholder);
		var _obj = {},
			_itemCount = 0,
			_valCount = 0,
			_hasRelation = false;
		$.each($tds, function(index, val) {
			//括号
			if ($(this).hasClass('bracket')) {
				_obj[$(this).hasClass('left-bracket') ? 'leftBracket' : 'rightBracket'] = $(this).find('.br-content').data('bracketCount') || 0;
				return true;
			};
			//跳过行操作
			if ($(this).hasClass('row-action')) return true;
			//填入数值
			var $item = $('input, select', this);
			//跳过非表单元素,首行关系字段
			if ($item.length <= 0 || isFirst && $item.hasClass('relation')) return true;
			if (!_hasRelation && $item.hasClass('relation')) _hasRelation = true;
			var _val = $.trim($item.val());
			//console.log(_val);
			_itemCount++;
			if (_val !== '') {
				_obj[$item.attr('name')] = _val;
				_valCount++;
			};
		});
		//这行信息为空
		if (_hasRelation) {
			if (_valCount + isFirst == 1) {
				return 'empty';
			};
		} else {
			if (_valCount == 0) {
				return 'empty'
			};
		}
		//检查属性是否完整
		if (_itemCount != _valCount) {
			this.showError('全部三个字段：属性，操作符和值必须完整。', '无效的' + clauseType);
			return false;
		};
		return this.checkOperators(_obj, clauseType) && _obj;
	},

	/**
	 * 检查括弧合法性
	 * @param  {Object} objArr     检查对象数组
	 * @param  {String} clauseType 对象类型(用于输出错误信息)
	 * @return {boolean}         检查结果
	 */
	checkBrackets: function(objArr, clauseType) {
		//console.log('checkBrackets');
		//console.log(objArr);
		var _leftCount = 0,
			_rightCount = 0;
		for (var i = 0, item = objArr[0]; i < objArr.length; item = objArr[++i]) {
			//console.log(item);
			_leftCount += item.leftBracket;
			_rightCount += item.rightBracket;
		}
		if (_leftCount != _rightCount) {
			this.showError('发现不匹配的括弧。', '无效的' + clauseType);
			return false;
		};
		return true;
	},
	/**
	 * 检查操作符合法性
	 * @param  {Object} obj     检查对象
	 * @param  {String} clauseType 对象类型(用于输出错误信息)
	 * @return {boolean}         检查结果
	 */
	checkOperators: function(obj, clauseType) {
		//console.log('checkOperators');
		var _operator = obj.operator,
			_val = obj.value,
			_showError = this.showError;
		if (!_operator) {
			return true;
		};
		switch (_operator) {
			case 'eq':
			case 'ueq':
			case 'gt':
			case 'lt':
			case 'gte':
			case 'lte':
				if (!isNum(_val)) {
					this.showError('值<span class="error">"' + _val + '"</span>不是一个有效的数值或CMDB对象。', '无效的' + clauseType);
					return false;
				};
				break;
			case 'between':
			case 'nbetween':
				return checkBetween(_val);
			case 'in':
			case 'nin':
				return checkIn(_val);
			case 'contains':
				break;
			case 'ncontains':
				return checkContains(obj.attribute);
			case 'is':
			case 'isnot':
				return checkIs(_val);
		}
		return true;



		function isNum(val) {
			return !isNaN(val);
		}

		function checkBetween(val) {
			var _valList = val.split(','),
				_valLow,
				_valHigh;
			if (_valList.length != 2 || !isNum(_valLow = +_valList[0]) || !isNum(_valHigh = +_valList[1])) {
				_showError('<span class="error">"' + val + '"</span><br>当BETWEEN和NOT BETWEEN操作符用于数值属性时，数值区间的最低值和最高值用逗号分开。<br><br>例如：1,25。', '无效的' + clauseType);
				return false;
			}
			if (_valLow >= _valHigh) {
				_showError('<span class="error">"' + val + '"</span><br>区间值不能是颠倒的。<br><br>第二个值必须大于第一个值。', '无效的' + clauseType);
				return false;
			};
			return true;
		}

		function checkIn(val) {
			var _valList = val.split(',');
			for (var i = 0; i < _valList.length; i++) {
				if (!isNum(_valList[i])) {
					_showError('<span class="error">"' + val + '"</span><br>值或值序列，必须每个都是数值，或一个有效的CMDB数值对象。', '无效的' + clauseType);
					return false;
				}
			}
			return true;
		}

		function checkIs(val) {
			if (val !== 'NULL') {
				_showError('<span class="error">"' + val + '"</span><br>当IS或IS NOT操作符被使用，值字段有效输入仅有：NULL.<br><br>单词NULL应该按照显示的来输入，全部用大写字母，并且没有引号或括弧包围。。', '无效的' + clauseType);
				return false;
			};
			return true;

		}

		/**
		 * 待定！！！！！
		 * @param  {[type]} val [description]
		 */
		function checkContains(val) {
			_showError('CONTAINS和NOT CONTAINS操作符只能和包含文本的属性（如原始事件日志）一起使用。', '无效的' + clauseType);
			return false;

			//return true;
		}

	}

}

var clauseFunc = {

	/**
	 * 解析给定的Clause对象，将数据展现在界面上
	 * @param {Clause Object} clauseObj 来源数据
	 * @param  {[type]} nameHandle  filter选择器
	 * @param  {[type]} filterHandle  filter选择器
	 * @param  {[type]} whereHandle   where选择器
	 * @param  {[type]} groupByHandle groupBy选择器
	 */
	setUpByJSON: function(clauseObj, nameHandle, filterHandle, whereHandle, groupByHandle) {
		console.log('setup');
		this.setUpName(nameHandle, clauseObj.name);
		this.setUpClause(filterHandle, clauseObj.filters);
		this.setUpClause(whereHandle, clauseObj.where);
		this.setUpClause(groupByHandle, clauseObj.groupBys);
	},

	/**
	 * 填充name
	 * @param  {String | JQuery Object} placeholder  目标容器
	 * @param {String} name        [description]
	 */
	setUpName: function(placeholder, name) {
		if (name === '' || name === null) {
			return;
		};
		$(placeholder).val(name);
	},

	setUpBracket: function(placeholder, count, isLeft) {
		if (!count) {
			return;
		};
		var _bracketItem = isLeft ? '(' : ')';
		var _brackets = '';
		while ((count--) && (_brackets += _bracketItem));
		var $target = $((isLeft ? '.left-bracket' : '.right-bracket') + ' .br-content', placeholder);
		$target.data('bracketCount', count).text(_brackets);
	},

	/**
	 * 填充clauses
	 * @param  {String | JQuery Object} placeholder  目标容器
	 * @param {Array} objArr         [description]
	 */
	setUpClause: function(placeholder, objArr) {
		if (!objArr) {
			return;
		};
		var $placeholder = $(placeholder);
		var _length = objArr.length;

		/*
		attribute: "attr2"leftBracket: 2operator: "lt"rightBracket: 0value: "2"
		*/
		var $template = $('.template', placeholder);
		for (var i = 0, _obj = objArr[0]; i < _length; _obj = objArr[++i]) {
			var $newTr = $template.clone(true, true).removeClass('template').insertBefore($template);
			this.setUpBracket($newTr, _obj.leftBracket, true);
			this.setUpBracket($newTr, _obj.rightBracket, false);
			$('.relation', $newTr).val(_obj.relation || '');
			$('[name="attribute"]', $newTr).val(_obj.attribute).chosen().trigger("chosen:updated");
			$('[name="operator"]', $newTr).val(_obj.operator);
			$('[name="value"]', $newTr).val(_obj.value);
		};
	}
}