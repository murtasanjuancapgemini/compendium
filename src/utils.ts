import {
  TextInSource,
  TextInSources,
  Index,
  IndexNode,
  IndexSource,
  DocConfig,
} from './types';
import { TextInMock, TextOutMock } from './mocks/impl';
import { EmitElement } from './emitFunctions';
import * as fs from 'fs';
import * as shelljs from 'shelljs';

export class Utilities {
  public static outputFile: any;
  public configPath: string;

  public constructor(config: string) {
    this.configPath = config;
  }
  /**
   * checkSourceValuesJSON
   * Check if the values in the JSON are correct, if somethig is wrong show an error
   * @public
   * @param {*} sourceJSON
   * @returns {boolean}
   * @memberof ConfigFile
   */
  public static checkSourceValuesJSON(sourceJSON: any): boolean {
    let valid = true;
    if (
      sourceJSON.key &&
      sourceJSON.key !== '' &&
      sourceJSON.kind &&
      (sourceJSON.kind === 'asciidoc' || sourceJSON.kind === 'confluence')
    ) {
      if (sourceJSON.kind === 'confluence') {
        if (sourceJSON.space && sourceJSON.space !== '' && sourceJSON.context) {
          valid = true;
        } else {
          valid = false;
        }
      }
    } else {
      valid = false;
    }
    return valid;
  }
  /**
   * checkNodeValuesJSON
   * check if the information on the nodes is correct
   * @public
   * @param {*} nodeJSON
   * @returns {boolean}
   * @memberof ConfigFile
   */
  public static checkNodeValuesJSON(nodeJSON: any): boolean {
    if (
      nodeJSON.key &&
      nodeJSON.key !== '' &&
      nodeJSON.file &&
      nodeJSON.file !== ''
    ) {
      return true;
    } else {
      return false;
    }
  }
  /**
   * checkDuplicateKeys
   * Check if configfile has keys duplicated, in this case show an error
   * @public
   * @param {IndexSource[]} indexSources
   * @returns {boolean}
   * @memberof ConfigFile
   */
  public static checkDuplicateKeys(indexSources: IndexSource[]): boolean {
    let duplicate = false;
    const source: any = {};
    indexSources.map(item => {
      const key = item.key;
      if (key in source) {
        duplicate = true;
      } else {
        source[key] = item;
      }
    });
    return duplicate;
  }
  /**
   * checkDuplicateKeys
   * Check if configfile has keys in the files that don´t exist in the source, in this case show an error
   * True for wrong key found
   * @public
   * @param {IndexSource[]} indexSources
   * @returns {boolean}
   * @memberof ConfigFile
   */
  public static checkFileKeysConsistency(index: Index): boolean {
    const indexSources: IndexSource[] = index[0] as IndexSource[];
    const indexNodes: IndexNode[] = index[1] as IndexNode[];
    //create array with all the keys from sources
    let sourceKeys: string[] = [];
    indexSources.map(item => {
      const key = item.key;
      sourceKeys.push(key);
    });
    let match = true;
    indexNodes.map(item => {
      const key = item.key;
      let number = sourceKeys.indexOf(key);
      if (number < 0) match = false; //this key don`t has its match in the sources array
    });

    return match;
  }

  /**
   * getKindByKey
   * create a relation with kind and key
   * @public
   * @param {IndexSource[]} indexSources
   * @param {string} key
   * @returns {string}
   * @memberof ConfigFile
   */
  public static getKindByKey(indexSources: IndexSource[], key: string): string {
    let kind = '';
    for (const source of indexSources) {
      if (source.key === key) {
        kind = source.kind;
      }
    }
    return kind;
  }
}
