const {
  DOLLAR_PLACEHOLDER,
  DOLLAR_AND_PLACEHOLDER,
  escapeAmisVariables,
  restoreAmisVariables,
  escapeParamsForFrontend,
  sanitizeParams,
} = require('../utils/amis-variable-escape');

describe('AMIS 变量转义/还原', () => {
  test.each([
    ['${ids}', '__VAR_ids__'],
    ['${items|count}', '__VAR_items__PIPE__count__'],
    ['${a|b:1|c:2}', '__VAR_a__PIPE__b__COLON__1__PIPE__c__COLON__2__'],
    ['x=${x}', 'x=__VAR_x__'],
    ['${&}', DOLLAR_AND_PLACEHOLDER],
  ])('escapeAmisVariables: %s -> %s', (input, expected) => {
    expect(escapeAmisVariables(input)).toBe(expected);
  });

  test.each([
    ['__VAR_ids__', '${ids}'],
    ['__VAR_items__PIPE__count__', '${items|count}'],
    ['__VAR_a__PIPE__b__COLON__1__PIPE__c__COLON__2__', '${a|b:1|c:2}'],
    [DOLLAR_AND_PLACEHOLDER, '${&}'],
    [DOLLAR_PLACEHOLDER, '$$'],
  ])('restoreAmisVariables: %s -> %s', (input, expected) => {
    expect(restoreAmisVariables(input)).toBe(expected);
  });
});

describe('对象/数组递归处理', () => {
  test('escapeParamsForFrontend: &=$$ 转义为占位符', () => {
    const obj = { '&': '$$' };
    escapeParamsForFrontend(obj);
    expect(obj['&']).toBe(DOLLAR_PLACEHOLDER);
  });

  test('escapeParamsForFrontend: [object Object] 转义为占位符', () => {
    const obj = { a: '[object Object]' };
    escapeParamsForFrontend(obj);
    expect(obj.a).toBe(DOLLAR_PLACEHOLDER);
  });

  test('escapeParamsForFrontend: 嵌套变量转义', () => {
    const obj = { a: { b: '${x}', c: ['${y}', 'ok'] } };
    escapeParamsForFrontend(obj);
    expect(obj.a.b).toBe('__VAR_x__');
    expect(obj.a.c[0]).toBe('__VAR_y__');
  });

  test('escapeParamsForFrontend: JSON 字符串内变量也会转义', () => {
    const obj = { a: '{"b":"${x}","c":["${y}"]}' };
    escapeParamsForFrontend(obj);
    expect(obj.a).toContain('__VAR_x__');
    expect(obj.a).toContain('__VAR_y__');
  });

  test('escapeParamsForFrontend: 非法 JSON 字符串走普通转义', () => {
    const obj = { a: '{bad json ${x}' };
    escapeParamsForFrontend(obj);
    expect(obj.a).toBe('{bad json __VAR_x__');
  });

  test('sanitizeParams: 占位符还原为 $$', () => {
    const obj = { a: DOLLAR_PLACEHOLDER };
    sanitizeParams(obj);
    expect(obj.a).toBe('$$');
  });

  test('sanitizeParams: ${&} 占位符还原', () => {
    const obj = { a: DOLLAR_AND_PLACEHOLDER };
    sanitizeParams(obj);
    expect(obj.a).toBe('${&}');
  });

  test('sanitizeParams: 变量占位符还原', () => {
    const obj = { a: '__VAR_x__' };
    sanitizeParams(obj);
    expect(obj.a).toBe('${x}');
  });

  test('sanitizeParams: JSON 字符串内占位符也会还原', () => {
    const obj = { a: '{"b":"__VAR_x__","c":"__DOLLAR_AND__"}' };
    sanitizeParams(obj);
    expect(obj.a).toContain('${x}');
    expect(obj.a).toContain('${&}');
  });

  test('sanitizeParams: 不含占位符的 ${x} 不会被误改', () => {
    const obj = { a: '${x}' };
    sanitizeParams(obj);
    expect(obj.a).toBe('${x}');
  });

  test('XSS 字符串不被改写', () => {
    const obj = { a: '<img src=x onerror=alert(1)>' };
    escapeParamsForFrontend(obj);
    sanitizeParams(obj);
    expect(obj.a).toBe('<img src=x onerror=alert(1)>');
  });

  test('复杂结构覆盖', () => {
    const obj = {
      a: [
        '$$',
        { b: '${x|count}', c: ['[object Object]', { d: '{"e":"${&}"}' }] },
      ],
      '&': '[object Object]',
    };
    escapeParamsForFrontend(obj);
    expect(obj['&']).toBe(DOLLAR_PLACEHOLDER);
    sanitizeParams(obj);
    expect(obj['&']).toBe('$$');
  });
});

