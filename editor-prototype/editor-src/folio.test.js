import {test} from 'node:test';import assert from 'node:assert/strict';
import {folioLabel,paragraphReference} from './folio.js';
test('essays notes and sketches display independent unpadded numbers',()=>{for(const [type,prefix] of [['Essay','e'],['Note','n'],['Sketch','s']]){const e={type,folioNumber:1};assert.equal(folioLabel(e),`${prefix}. 1`);assert.equal(paragraphReference(e,3),`${prefix}.1.3`)}});
test('drafts have no publication number and type changes cannot reuse another type number',()=>{assert.equal(folioLabel({type:'Note'}),'n. Draft');assert.equal(paragraphReference({type:'Note'},2),'¶2');const e={type:'Note',folioType:'Essay',folioNumber:2,folioNumbers:{Essay:2}};assert.equal(folioLabel(e),'n. Draft');e.folioNumbers.Note=4;assert.equal(folioLabel(e),'n. 4')});
test('numbering continues past 999',()=>{assert.equal(folioLabel({type:'Essay',folioNumber:1000}),'e. 1000')});
