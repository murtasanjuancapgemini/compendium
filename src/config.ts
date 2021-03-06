import { TextInSource, TextInSources, Index, IndexNode, IndexSource, DocConfig } from './types';
import { TextInMock, TextOutMock } from './mocks/impl';
import { Utilities } from './utils';
import * as fs from 'fs';
import * as util from 'util';

export let mock = false;

export class ConfigFile implements DocConfig {

    public configPath: string;

    public constructor(config: string) {
        this.configPath = config;
    }
    /**
     * getIndex
     * Get the index in the config.json file
     * @returns {Promise<Index>}
     * @memberof ConfigFile
     */
    public async getIndex(): Promise<Index> {
        const readFile = util.promisify(fs.readFile);
        const config = await readFile(this.configPath, 'utf8');
        const data = JSON.parse(config);
        const indexSources: IndexSource[] = [];
        for (const source of data.sources) {
            if (Utilities.checkSourceValuesJSON(source)) {
                const indexSource: IndexSource = {
                    key: source.key,
                    kind: source.kind,
                    source: source.source,
                };
                if (source.kind === 'confluence') {
                    indexSource.space = source.space;
                    indexSource.context = source.context;
                }
                indexSources.push(indexSource);
            } else {
                throw new Error('JSON: Some sources don\'t have a valid property/value');
            }
        }
        if (Utilities.checkDuplicateKeys(indexSources)) {
            throw new Error('JSON: Data inconsistency, some sources have the same key.');
        }
        const indexNodes: IndexNode[] = [];
        for (const node of data.nodes) {
            if (Utilities.checkNodeValuesJSON(node)) {
                const indexNode: IndexNode = {
                    key: node.key,
                    index: node.index,
                };
                if (node.sections !== null && node.sections !== '' && node.sections !== undefined) {
                    if (node.sections.isArray()) {
                        indexNode.sections = node.sections;
                    } else {
                        console.log('The array of sections in ' + node.index + ' is malformed. All document will be loaded.\n');
                    }
                }
                indexNodes.push(indexNode);
            } else {
                throw new Error('JSON: Some nodes don\'t have a valid property/value');
            }
        }
        const index: Index = [indexSources, indexNodes];
        return index;
    }
}