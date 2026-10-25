import { describe, expect, it } from 'vitest'
import { parseCsv } from '../aggregator'

const timestamp = '2026-10-25T10:00:00Z'

describe('parseCsv', () => {
  it.each([
    ['commas', '"Browser, Inc.","Inbox, today"', 'Browser, Inc.', 'Inbox, today'],
    ['escaped quotes', '"My ""App""","Say ""hello"""', 'My "App"', 'Say "hello"'],
    ['LF in text', '"App\nname","First\nsecond"', 'App\nname', 'First\nsecond'],
    ['CRLF in text', '"App\r\nname","First\r\nsecond"', 'App\r\nname', 'First\r\nsecond'],
    ['empty quoted fields', '"",""', '', ''],
    ['trimmed quoted text', '"  App  "," \n Title \r\n "', 'App', 'Title'],
  ])('decodes %s without shifting numeric columns', (_label, fields, appName, title) => {
    expect(parseCsv(`${timestamp},${fields},12,34`)).toEqual([
      { timestamp: new Date(timestamp), appName, title, value1: 12, value2: 34 },
    ])
  })

  it.each(['\n', '\r\n'])('keeps records after multiline titles with %j endings', (eol) => {
    const csv = [
      `${timestamp},Browser,"First${eol}second",12,34`,
      '2026-10-25T10:01:00Z,Editor,Next,56,78',
      '',
      '',
    ].join(eol)

    expect(parseCsv(csv)).toEqual([
      {
        timestamp: new Date(timestamp),
        appName: 'Browser',
        title: `First${eol}second`,
        value1: 12,
        value2: 34,
      },
      {
        timestamp: new Date('2026-10-25T10:01:00Z'),
        appName: 'Editor',
        title: 'Next',
        value1: 56,
        value2: 78,
      },
    ])
  })

  it('trims legacy fields, converts timestamps and numbers, and sorts entries', () => {
    expect(
      parseCsv(
        `2026-10-25T12:01:00+02:00, Later app , Later title , 3 , 4 \n ${timestamp} , App , Title , 1 , 2 `,
      ),
    ).toEqual([
      { timestamp: new Date(timestamp), appName: 'App', title: 'Title', value1: 1, value2: 2 },
      {
        timestamp: new Date('2026-10-25T10:01:00Z'),
        appName: 'Later app',
        title: 'Later title',
        value1: 3,
        value2: 4,
      },
    ])
  })

  it('preserves the existing invalid-row and optional-number policies', () => {
    const csv = [
      '',
      '   ',
      `${timestamp},too few fields`,
      'invalid timestamp,App,Title,1,2',
      `${timestamp},,,,`,
      `${timestamp},App,Missing numbers`,
      `${timestamp},App,Invalid numbers,nope,nope,ignored`,
      `${timestamp},App,One number,5`,
    ].join('\n')

    expect(parseCsv(csv)).toEqual([
      { timestamp: new Date(timestamp), appName: '', title: '', value1: 0, value2: 0 },
      {
        timestamp: new Date(timestamp),
        appName: 'App',
        title: 'Missing numbers',
        value1: NaN,
        value2: NaN,
      },
      {
        timestamp: new Date(timestamp),
        appName: 'App',
        title: 'Invalid numbers',
        value1: NaN,
        value2: NaN,
      },
      {
        timestamp: new Date(timestamp),
        appName: 'App',
        title: 'One number',
        value1: 5,
        value2: NaN,
      },
    ])
  })

  it.each(['', '\n', '\r\n', '  \n\r\n'])('accepts empty input %j', (csv) => {
    expect(parseCsv(csv)).toEqual([])
  })
})
