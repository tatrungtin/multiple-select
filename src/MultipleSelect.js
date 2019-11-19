import Constants from './constants/index.js'
import {s, sprintf, compareObjects, removeDiacritics} from './utils/index.js'

class MultipleSelect {
  constructor ($el, options) {
    this.$el = $el
    this.options = $.extend({}, Constants.DEFAULTS, options)
  }

  init () {
    this.initLocale()
    this.initContainer()
    this.initData()
    this.initFilter()
    this.initDrop()
    this.initView()
    this.options.onAfterCreate()
  }

  initLocale () {
    if (this.options.locale) {
      const {locales} = $.fn.multipleSelect
      const parts = this.options.locale.split(/-|_/)

      parts[0] = parts[0].toLowerCase()
      if (parts[1]) {
        parts[1] = parts[1].toUpperCase()
      }

      if (locales[this.options.locale]) {
        $.extend(this.options, locales[this.options.locale])
      } else if (locales[parts.join('-')]) {
        $.extend(this.options, locales[parts.join('-')])
      } else if (locales[parts[0]]) {
        $.extend(this.options, locales[parts[0]])
      }
    }
  }

  initContainer () {
    const el = this.$el[0]
    const name = el.getAttribute('name') || this.options.name || ''

    // hide select element
    this.$el.hide()

    // label element
    this.$label = this.$el.closest('label')
    if (!this.$label.length && this.$el.attr('id')) {
      this.$label = $(`label[for="${this.$el.attr('id')}"]`)
    }
    if (this.$label.find('>input').length) {
      this.$label = null
    }

    // restore class and title from select element
    this.$parent = $(sprintf`<div class="ms-parent ${s}" ${s}/>`(
      el.getAttribute('class') || '',
      sprintf`title="${s}"`(el.getAttribute('title'))
    ))

    // add placeholder to choice button
    this.options.placeholder = this.options.placeholder ||
      el.getAttribute('placeholder') || ''
    this.$choice = $(sprintf`
      <button type="button" class="ms-choice">
      <span class="placeholder">${s}</span>
      <div></div>
      </button>
    `(this.options.placeholder))

    // default position is bottom
    this.$drop = $(sprintf`<div class="ms-drop ${s}"></div>`(this.options.position))

    if (this.options.dropWidth) {
      this.$drop.css('width', this.options.dropWidth)
    }

    this.$el.after(this.$parent)
    this.$parent.append(this.$choice)
    this.$parent.append(this.$drop)

    if (el.disabled) {
      this.$choice.addClass('disabled')
    }

    this.selectAllName = `data-name="selectAll${name}"`
    this.selectGroupName = `data-name="selectGroup${name}"`
    this.selectItemName = `data-name="selectItem${name}"`

    if (!this.options.keepOpen) {
      $(document).click(e => {
        if (
          $(e.target)[0] === this.$choice[0] ||
          $(e.target).parents('.ms-choice')[0] === this.$choice[0]
        ) {
          return
        }
        if (
          ($(e.target)[0] === this.$drop[0] ||
          ($(e.target).parents('.ms-drop')[0] !== this.$drop[0] &&
          e.target !== el)) &&
          this.options.isOpen
        ) {
          this.close()
        }
      })
    }
  }

  initData () {
    const data = []

    if (this.options.data) {
      this.options.data.forEach((row, i) => {
        if (row.type === 'optgroup') {
          row.group = row.group || `group_${i}`

          row.children.forEach(child => {
            child.group = child.group || row.group
          })
        }
      })
      this.data = this.options.data.map(it => {
        if (typeof it === 'string' || typeof it === 'number') {
          return {
            text: it,
            value: it
          }
        }
        return it
      })
      return
    }

    $.each(this.$el.children(), (i, elm) => {
      const row = this.initRow(i, elm)
      if (row) {
        data.push(this.initRow(i, elm))
      }
    })

    this.options.data = data
    this.data = data
    this.fromHtml = true
  }

  initRow (i, elm, group, groupDisabled) {
    const row = {}
    const $elm = $(elm)

    if ($elm.is('option')) {
      row.type = 'option'
      row.group = group
      row.text = this.options.textTemplate($elm)
      row.value = elm.value
      row.selected = elm.selected
      row.disabled = groupDisabled || elm.disabled
      row.classes = elm.getAttribute('class') || ''
      row.title = elm.getAttribute('title')

      return row
    }

    if ($elm.is('optgroup')) {
      row.type = 'optgroup'
      row.group = `group_${i}`
      row.label = this.options.labelTemplate($elm)
      row.disabled = elm.disabled
      row.children = []

      $.each($elm.children(), (j, elem) => {
        row.children.push(this.initRow(j, elem, row.group, row.disabled))
      })

      return row
    }

    return null
  }

  initFilter () {
    if (this.options.filter || !this.options.filterByDataLength) {
      return
    }

    let length = 0
    for (const option of this.data) {
      if (option.type === 'optgroup') {
        length += option.children.length
      } else {
        length += 1
      }
    }

    this.options.filter = length > this.options.filterByDataLength
  }

  initDrop () {
    this.initList()
    this.events()
    this.update(true)
    this.updateOptGroupSelect(true)
    this.updateSelectAll(false, true)

    if (this.options.isOpen) {
      this.open()
    }

    if (this.options.openOnHover) {
      this.$parent.hover(() => {
        this.open()
      }, () => {
        this.close()
      })
    }
  }

  initList () {
    const html = []

    if (this.options.filter) {
      html.push(`
        <div class="ms-search">
          <input type="text" autocomplete="off" autocorrect="off"
            autocapitalize="off" spellcheck="false"
            ${sprintf`placeholder="${s}"`(this.options.filterPlaceholder)}>
        </div>
      `)
    }

    html.push('<ul>')

    if (this.options.selectAll && !this.options.single) {
      html.push([
        '<li class="ms-select-all">',
        '<label>',
        sprintf`<input type="checkbox" ${s} />`(this.selectAllName),
        `<span>${this.options.formatSelectAll()}</span>`,
        '</label>',
        '</li>'
      ].join(''))
    }

    html.push(this.data.map(row => {
      return this.initListItem(row)
    }).join(''))

    html.push(sprintf`<li class="ms-no-results">${s}</li>`(
      this.options.formatNoMatchesFound()
    ))

    html.push('</ul>')

    this.$drop.html(html.join(''))
    this.$drop.find('ul').css('max-height', `${this.options.maxHeight}px`)
    this.$drop.find('.multiple').css('width', `${this.options.multipleWidth}px`)

    this.$searchInput = this.$drop.find('.ms-search input')
    this.$selectAll = this.$drop.find(`input[${this.selectAllName}]`)
    this.$selectGroups = this.$drop.find(`input[${this.selectGroupName}],span[${this.selectGroupName}]`)
    this.$selectItems = this.$drop.find(`input[${this.selectItemName}]:enabled`)
    this.$disableItems = this.$drop.find(`input[${this.selectItemName}]:disabled`)
    this.$noResults = this.$drop.find('.ms-no-results')
  }

  initListItem (row, level = 0) {
    const title = sprintf`title="${s}"`(row.title)
    const multiple = this.options.multiple ? 'multiple' : ''
    const type = this.options.single ? 'radio' : 'checkbox'
    let classes = ''

    if (this.options.single && !this.options.singleRadio) {
      classes = 'hide-radio '
    }

    if (row.type === 'optgroup') {
      const customStyle = this.options.styler(row)
      const style = customStyle ? sprintf`style="${s}"`(customStyle) : ''
      const html = []

      html.push([
        `<li class="group ${classes}" ${style}>`,
        sprintf`<label class="optgroup ${s}" data-group="${s}">`(
          row.disabled ? 'disabled' : '', row.group
        ),
        this.options.hideOptgroupCheckboxes || this.options.single
          ? sprintf`<span ${s}></span>`(this.selectGroupName)
          : sprintf`<input type="checkbox" ${s} ${s}>`(
            this.selectGroupName, row.disabled ? 'disabled="disabled"' : ''
          ),
        row.label,
        '</label>',
        '</li>'
      ].join(''))

      html.push(row.children.map(child => {
        return this.initListItem(child, 1)
      }).join(''))

      return html.join('')
    }

    const customStyle = this.options.styler(row)
    const style = customStyle ? sprintf`style="${s}"`(customStyle) : ''
    classes += (row.classes || '')

    if (level && this.options.single) {
      classes += `option-level-${level} `
    }

    return [
      sprintf`<li class="${s} ${s}" ${s} ${s}>`(multiple, classes, title, style),
      sprintf`<label class="${s}">`(row.disabled ? 'disabled' : ''),
      sprintf`<input type="${s}" value="${s}" ${s}${s}${s}${s}>`(
        type,
        row.value,
        this.selectItemName,
        row.selected ? ' checked="checked"' : '',
        row.disabled ? ' disabled="disabled"' : '',
        sprintf` data-group="${s}"`(row.group)
      ),
      sprintf`<span>${s}</span>`(row.text),
      '</label>',
      '</li>'
    ].join('')
  }

  initView () {
    let computedWidth

    if (window.getComputedStyle) {
      computedWidth = window.getComputedStyle(this.$el[0]).width

      if (computedWidth === 'auto') {
        computedWidth = this.$drop.outerWidth() + 20
      }
    } else {
      computedWidth = this.$el.outerWidth() + 20
    }

    this.$parent.css('width', this.options.width || computedWidth)

    this.$el.show().addClass('ms-offscreen')
  }

  events () {
    const toggleOpen = e => {
      e.preventDefault()
      this[this.options.isOpen ? 'close' : 'open']()
    }

    if (this.$label && this.$label.length) {
      this.$label.off('click').on('click', e => {
        if (e.target.nodeName.toLowerCase() !== 'label') {
          return
        }
        toggleOpen(e)
        if (!this.options.filter || !this.options.isOpen) {
          this.focus()
        }
        e.stopPropagation() // Causes lost focus otherwise
      })
    }

    this.$choice.off('click').on('click', toggleOpen)
      .off('focus').on('focus', this.options.onFocus)
      .off('blur').on('blur', this.options.onBlur)

    this.$parent.off('keydown').on('keydown', e => {
      // esc key
      if (e.which === 27 && !this.options.keepOpen) {
        this.close()
        this.$choice.focus()
      }
    })

    this.$searchInput.off('keydown').on('keydown', e => {
      // Ensure shift-tab causes lost focus from filter as with clicking away
      if (e.keyCode === 9 && e.shiftKey) {
        this.close()
      }
    }).off('keyup').on('keyup', e => {
      // enter or space
      // Avoid selecting/deselecting if no choices made
      if (
        this.options.filterAcceptOnEnter &&
        [13, 32].includes(e.which) &&
        this.$searchInput.val()
      ) {
        if (this.options.single) {
          const $items = this.$selectItems.closest('li').filter(':visible')
          if ($items.length) {
            this.setSelects([$items.first().find(`input[${this.selectItemName}]`).val()])
          }
        } else {
          this.$selectAll.click()
        }
        this.close()
        this.focus()
        return
      }
      this.filter()
    })

    this.$selectAll.off('click').on('click', e => {
      const checked = $(e.currentTarget).prop('checked')
      const $items = this.$selectItems.filter(':visible')

      if ($items.length === this.$selectItems.length) {
        this[checked ? 'checkAll' : 'uncheckAll']()
      } else { // when the filter option is true
        this.$selectGroups.prop('checked', checked)
        $items.prop('checked', checked)
        this.options[checked ? 'onCheckAll' : 'onUncheckAll']()
        this.update()
      }
    })

    this.$selectGroups.off('click').on('click', e => {
      const $this = $(e.currentTarget)
      const group = $this.parent()[0].getAttribute('data-group')
      const $items = this.$selectItems.filter(':visible')
      const $children = $items.filter(sprintf`[data-group="${s}"]`(group))
      const checked = $children.length !== $children.filter(':checked').length

      $children.prop('checked', checked)
      this.updateSelectAll(true)
      this.update()
      this.options.onOptgroupClick({
        label: $this.parent().text(),
        checked,
        children: $children.get().map(el => {
          return {
            label: $(el).parent().text(),
            value: $(el).val(),
            check: $(el).prop('checked')
          }
        })
      })
    })

    this.$selectItems.off('click').on('click', e => {
      const $this = $(e.currentTarget)

      if (this.options.single) {
        const clickedVal = $this.val()
        this.$selectItems.filter((i, el) => {
          return $(el).val() !== clickedVal
        }).each((i, el) => {
          $(el).prop('checked', false)
        })
      }

      this.updateSelectAll(true)
      this.update()
      this.updateOptGroupSelect()
      this.options.onClick({
        label: $this.parent().text(),
        value: $this.val(),
        checked: $this.prop('checked')
      })

      if (this.options.single && this.options.isOpen && !this.options.keepOpen) {
        this.close()
      }
    })
  }

  open () {
    if (this.$choice.hasClass('disabled')) {
      return
    }
    this.options.isOpen = true
    this.$choice.find('>div').addClass('open')
    this.$drop[this.animateMethod('show')]()

    // fix filter bug: no results show
    this.$selectAll.parent().show()
    this.$noResults.hide()

    // Fix #77: 'All selected' when no options
    if (!this.data.length) {
      this.$selectAll.parent().hide()
      this.$noResults.show()
    }

    if (this.options.container) {
      const offset = this.$drop.offset()
      this.$drop.appendTo($(this.options.container))
      this.$drop.offset({
        top: offset.top,
        left: offset.left
      })
        .css('min-width', 'auto')
        .outerWidth(this.$parent.outerWidth())
    }

    if (this.data.length && this.options.filter) {
      this.$searchInput.val('')
      this.$searchInput.focus()
      this.filter()
    }
    this.options.onOpen()
  }

  close () {
    this.options.isOpen = false
    this.$choice.find('>div').removeClass('open')
    this.$drop[this.animateMethod('hide')]()
    if (this.options.container) {
      this.$parent.append(this.$drop)
      this.$drop.css({
        'top': 'auto',
        'left': 'auto'
      })
    }
    this.options.onClose()
  }

  animateMethod (method) {
    const methods = {
      show: {
        fade: 'fadeIn',
        slide: 'slideDown'
      },
      hide: {
        fade: 'fadeOut',
        slide: 'slideUp'
      }
    }

    return methods[method][this.options.animate] || method
  }

  update (ignoreTrigger) {
    let textSelects = this.getSelects('text')

    if (this.options.displayHtml) {
      textSelects = this.getSelects('html')
    } else if (this.options.displayValues) {
      textSelects = this.getSelects()
    }

    const $span = this.$choice.find('>span')
    const sl = textSelects.length
    let html = ''

    if (sl === 0) {
      $span.addClass('placeholder').html(this.options.placeholder)
    } else if (sl < this.options.minimumCountSelected) {
      html = textSelects.join(this.options.displayDelimiter)
    } else if (this.options.formatAllSelected() && sl === this.$selectItems.length + this.$disableItems.length) {
      html = this.options.formatAllSelected()
    } else if (this.options.ellipsis && sl > this.options.minimumCountSelected) {
      html = `${textSelects.slice(0, this.options.minimumCountSelected)
        .join(this.options.displayDelimiter)}...`
    } else if (this.options.formatCountSelected() && sl > this.options.minimumCountSelected) {
      html = this.options.formatCountSelected(
        sl, this.$selectItems.length + this.$disableItems.length
      )
    } else {
      html = textSelects.join(this.options.displayDelimiter)
    }

    if (html) {
      $span.removeClass('placeholder').html(html)
    }

    if (this.options.displayTitle) {
      $span.prop('title', this.getSelects('text'))
    }

    // set selects to select
    this.$el.val(this.getSelects())

    // add selected class to selected li
    this.$drop.find('li').removeClass('selected')
    this.$drop.find('input:checked').each((i, el) => {
      $(el).parents('li').first().addClass('selected')
    })

    // trigger <select> change event
    if (!ignoreTrigger) {
      this.$el.trigger('change')
    }
  }

  updateSelectAll (triggerEvent, all = false) {
    let $items = this.$selectItems

    if (!all) {
      $items = $items.filter(':visible')
    }

    const selectedLength = $items.filter(':checked').length

    this.$selectAll.prop('checked', selectedLength === $items.length)

    if (triggerEvent) {
      if (selectedLength === $items.length) {
        this.options.onCheckAll()
      } else if (selectedLength === 0) {
        this.options.onUncheckAll()
      }
    }
  }

  updateOptGroupSelect (all = false) {
    let $items = this.$selectItems

    if (!all) {
      $items = $items.filter(':visible')
    }
    $.each(this.$selectGroups, (i, val) => {
      const group = $(val).parent()[0].getAttribute('data-group')
      const $children = $items.filter(sprintf`[data-group="${s}"]`(group))
      $(val).prop('checked', $children.length &&
        $children.length === $children.filter(':checked').length)
    })
  }

  getOptions () {
    // deep copy and remove data
    const options = $.extend({}, this.options)
    delete options.data
    return $.extend(true, {}, options)
  }

  refreshOptions (options) {
    // If the objects are equivalent then avoid the call of destroy / init methods
    if (compareObjects(this.options, options, true)) {
      return
    }
    this.options = $.extend(this.options, options)
    this.destroy()
    this.init()
  }

  // value html, or text, default: 'value'
  getSelects (type) {
    let texts = []
    const values = []
    this.$drop.find(sprintf`input[${s}]:checked`(this.selectItemName)).each((i, el) => {
      texts.push($(el).next()[type === 'html' ? 'html' : 'text']())
      values.push($(el).val())
    })

    if (
      type === 'text' &&
      this.$selectGroups.length &&
      !this.options.single
    ) {
      texts = []
      this.$selectGroups.each((i, el) => {
        const html = []
        const text = $.trim($(el).parent().text())
        const group = $(el).parent().data('group')
        const $children = this.$drop.find(sprintf`[${s}][data-group="${s}"]`(
          this.selectItemName, group
        ))
        const $selected = $children.filter(':checked')

        if (!$selected.length) {
          return
        }

        html.push('[')
        html.push(text)
        if ($children.length >= $selected.length) {
          const list = []
          $selected.each((j, elem) => {
            list.push($(elem).parent().text())
          })
          html.push(`: ${list.join(', ')}`)
        }
        html.push(']')
        texts.push(html.join(''))
      })
    }
    return ['html', 'text'].includes(type) ? texts : values
  }

  setSelects (values) {
    this.$selectItems.prop('checked', false)
    this.$disableItems.prop('checked', false)
    $.each(values, (i, value) => {
      this.$selectItems.filter(sprintf`[value="${s}"]`(value)).prop('checked', true)
      this.$disableItems.filter(sprintf`[value="${s}"]`(value)).prop('checked', true)
    })
    this.$selectAll.prop('checked', this.$selectItems.length ===
      this.$selectItems.filter(':checked').length + this.$disableItems.filter(':checked').length)

    $.each(this.$selectGroups, (i, val) => {
      const group = $(val).parent()[0].getAttribute('data-group')
      const $children = this.$selectItems.filter(`[data-group="${group}"]`)
      $(val).prop('checked', $children.length &&
        $children.length === $children.filter(':checked').length)
    })

    this.update(false)
  }

  enable () {
    this.$choice.removeClass('disabled')
  }

  disable () {
    this.$choice.addClass('disabled')
  }

  check (value) {
    if (this.options.single) {
      this.$selectItems.prop('checked', false)
      this.$disableItems.prop('checked', false)
    }
    this._check(value, true)
  }

  uncheck (value) {
    this._check(value, false)
  }

  _check (value, checked) {
    this.$selectItems.filter(sprintf`[value="${s}"]`(value)).prop('checked', checked)
    this.$disableItems.filter(sprintf`[value="${s}"]`(value)).prop('checked', checked)
    this.update()
    this.updateOptGroupSelect(true)
    this.updateSelectAll(true, true)
  }

  checkAll () {
    this._checkAll(true)
    this.options.onCheckAll()
  }

  uncheckAll () {
    this._checkAll(false)
    this.options.onUncheckAll()
  }

  _checkAll (checked) {
    this.$selectItems.prop('checked', checked)
    this.$selectGroups.prop('checked', checked)
    this.$selectAll.prop('checked', checked)
    this.update()
  }

  checkInvert () {
    if (this.options.single) {
      return
    }
    this.$selectItems.each((i, el) => {
      $(el).prop('checked', !$(el).prop('checked'))
    })
    this.update()
    this.updateOptGroupSelect(true)
    this.updateSelectAll(true, true)
  }

  focus () {
    this.$choice.focus()
    this.options.onFocus()
  }

  blur () {
    this.$choice.blur()
    this.options.onBlur()
  }

  refresh () {
    this.destroy()
    this.init()
  }

  filter () {
    const originalText = $.trim(this.$searchInput.val())
    const text = originalText.toLowerCase()

    if (text.length === 0) {
      this.$selectAll.closest('li').show()
      this.$selectItems.closest('li').show()
      this.$disableItems.closest('li').show()
      this.$selectGroups.closest('li').show()
      this.$noResults.hide()
    } else {
      if (!this.options.filterGroup) {
        this.$selectItems.each((i, el) => {
          const $parent = $(el).parent()
          const hasText = this.options.customFilter(
            removeDiacritics($parent.text().toLowerCase()),
            removeDiacritics(text),
            $parent.text(), originalText)
          $parent.closest('li')[hasText ? 'show' : 'hide']()
        })
      }
      this.$disableItems.closest('li').hide()
      this.$selectGroups.each((i, el) => {
        const $parent = $(el).parent()
        const group = $parent[0].getAttribute('data-group')
        if (this.options.filterGroup) {
          const hasText = this.options.customFilter(
            removeDiacritics($parent.text().toLowerCase()),
            removeDiacritics(text),
            $parent.text(), originalText)
          const func = hasText ? 'show' : 'hide'
          $parent.closest('li')[func]()
          this.$selectItems.filter(`[data-group="${group}"]`).closest('li')[func]()
        } else {
          const hasText = this.$selectItems
            .filter(`[data-group="${group}"]`)
            .closest('li').filter(':visible')
            .length

          $parent.closest('li')[hasText ? 'show' : 'hide']()
        }
      })

      // Check if no matches found
      if (this.$selectItems.closest('li').filter(':visible').length) {
        this.$selectAll.closest('li').show()
        this.$noResults.hide()
      } else {
        this.$selectAll.closest('li').hide()
        this.$noResults.show()
      }
    }
    this.updateOptGroupSelect()
    this.updateSelectAll()
    this.options.onFilter(text)
  }

  destroy () {
    if (!this.$parent) {
      return
    }
    this.$el.before(this.$parent).removeClass('ms-offscreen')
    this.$parent.remove()

    if (this.fromHtml) {
      delete this.options.data
      this.fromHtml = false
    }
  }
}

export default MultipleSelect
