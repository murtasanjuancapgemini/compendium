import { DocConfig, IndexSource, Index, TextOut, TextIn, Transcript, Paragraph, TextSegment, TextElement, InlineImage, TextInSources, RichString, RichText, TextAttributes, Cookies, ConfluenceService, Table, TableSegment, TableBody, Col, Row, Cell, Code, Credentials, List, Link } from './types';
import * as fs from 'fs';
import { ConfluenceServiceImpl } from './confluenceService';
import { ConfluenceServiceImplMock } from './mocks/impl';
/*
    The basepath has to have this format: https://adcenter.pl.s2-eu.capgemini.com/confluence/

    Where context has to be /confluence/

    API REST: /rest/api/content

    Parameters:
                &title=My+Title    -> title
                &spaceKey=JQ       -> Workspace
                ?expand=body.view  -> For html content
                &type=page         -> Content type
                ...                -> more info: https://docs.atlassian.com/atlassian-confluence/REST/6.6.0/#content-getContent

    For a page name 'Hello world':  https://adcenter.pl.s2-eu.capgemini.com/confluence/rest/api/content?title=hello+world&expand=body.view
    */

export class ConfluenceTextIn implements TextIn {

    private baseURL: string;
    private spaceKey: string | undefined;
    private cookies: Cookies | undefined;
    private credentials: Credentials | undefined;
    private mock: boolean | undefined;

    private htmlparse = require('html-parse');

    public constructor(baseURL: string, spaceKey: string | undefined, auth: Cookies | Credentials, isMock?: boolean) {

        this.baseURL = baseURL;
        this.spaceKey = spaceKey;
        if ((auth as Cookies)[0]) {
            this.cookies = (auth as Cookies);
        } else if ((auth as Credentials).username) {
            this.credentials = (auth as Credentials);
        }
        this.mock = isMock;
    }
    /**
     * getTrancript
     * Get the transcript file to write on a single file
     * @param {string} title
     * @param {string[]} [sections]
     * @returns {Promise<Transcript>}
     * @memberof ConfluenceTextIn
     */
    public async getTranscript(title: string, sections?: string[]): Promise<Transcript> {

        const transcript: Transcript = { segments: [] };
        const end: Array<TextSegment> = [];
        let confluenceService: ConfluenceService;

        if (this.baseURL === '') {
            throw new Error('ConfluenceTextIn: BaseURL cannot be blank.');
        } else if (this.spaceKey === undefined) {
            throw new Error('ConfluenceTextIn: SpaceKey is undefined.');
        } else if (this.spaceKey === '') {
            throw new Error('ConfluenceTextIn: SpaceKey cannot be blank.');
        }
        if (this.mock) {
            confluenceService = new ConfluenceServiceImplMock();
        } else {
            confluenceService = new ConfluenceServiceImpl();
        }

        const uri = this.createURIbyTitle(title);
        const url = this.createURLbyTitle(title);

        let content;
        let error = false;
        if (this.cookies) {
            try {
                content = await confluenceService.getContentbyCookies(uri, this.cookies);
            } catch (err) {
                if (err.message) {
                    throw new Error(err.message);
                } else {
                    throw new Error('It isn\'t possible to get the content from confluence');
                }
            }
        } else if (this.credentials) {
            try {
                content = await confluenceService.getContentbyCredentials(uri, this.credentials);
            } catch (err) {
                if (err.message) {
                    throw new Error(err.message);
                } else {
                    throw new Error('It isn\'t possible to get the content from confluence');
                }
            }
        } else {
            throw new Error('Credentials are mandatory to access confluence resources');
        }
        if (content) {

            const htmlView = this.processDataFromConfluence(content);
            if (htmlView) {

                const tree = this.htmlparse.parse(htmlView);
                for (const branch of tree) {
                    const temp = await this.recursive(branch);
                    for (const final of temp) {
                        end.push(final);
                    }
                }
                transcript.segments = end;
            } else {
                error = true;
            }
        } else {
            error = true;
        }
        if (error) {
            throw new Error('It isn\'t possible to get transcript from ' + url);
        }
        return transcript;
    }
    /**
     * processDataFromConfluence
     * Read the JSON content from Confluence to parse it
     * @private
     * @param {JSON} content
     * @returns {string}
     * @memberof ConfluenceTextIn
     */
    private processDataFromConfluence(content: JSON): string {

        let htmlContent;
        let error = false;

        const parsed_content = JSON.parse(JSON.stringify(content));
        if (parsed_content.id) {
            if (parsed_content.body.view.value) {
                htmlContent = parsed_content.body.view.value;
            } else {
                error = true;
            }
        } else if (parsed_content.results) {
            if (parsed_content.size === 1 && parsed_content.results[0].id) {
                if (parsed_content.results[0].body.view.value) {
                    htmlContent = parsed_content.results[0].body.view.value;
                } else {
                    error = true;
                }
            } else {
                throw new Error('Only one Confluence page is allowed at once in this version. Check your request please.');
            }
        }
        if (error) {
            throw new Error('Received JSON from Confluence is not in a proper format.');
        }
        return htmlContent;
    }

    /*
        Confluence API REST

        URL: https://adcenter.pl.s2-eu.capgemini.com/confluence/display/JQ/Jump+the+queue+Home
        URI: https://adcenter.pl.s2-eu.capgemini.com/confluence/rest/api/content?title=Jump+the+queue+Home&expand=body.view

        Example:

        pathName: display/JQ/Jump+the+queue+Home
        pathNameRest: rest/api/content?spaceKey=JQ&title=Jump+the+queue+Home&expand=body.view

    */
    /**
     * createURIbyTitle
     * Create the URI to get de JSON since the known title
     * @private
     * @param {string} title
     * @returns {string}
     * @memberof ConfluenceTextIn
     */
    private createURIbyTitle(title: string): string {

        let outputURI = '';

        if (title !== '') {
            outputURI += this.baseURL + `rest/api/content?spaceKey=${this.spaceKey}&title=${title}&expand=body.view`;
        } else {
            throw new Error('CreateURI: Title cannot be blank');
        }
        return outputURI;
    }
    /**
     * createURLbyTitle
     * Create the URL to get the JSON by confluence title
     * @private
     * @param {string} title
     * @returns {string}
     * @memberof ConfluenceTextIn
     */
    private createURLbyTitle(title: string): string {
        let outputURL = '';
        if (title !== '') {
            outputURL += this.baseURL + `display/${this.spaceKey}/${title}`;
        } else {
            throw new Error('CreateURL: Title cannot be blank');
        }
        return outputURL;
    }
    /**
     * recursive
     * Read the elements on the tree recursively since find a known node
     * @param {*} node
     * @param {string[]} [filter]
     * @returns {Array<TextSegment>}
     * @memberof ConfluenceTextIn
     */
    public recursive(node: any, filter?: string[]): Array<TextSegment> {
        const result: Array<TextSegment> = [];
        let out: TextSegment;
        if (node.children) {
            if (node.name === 'h1') {
                out = { kind: 'textelement', element: 'title', text: this.paragraphs(node.children) };
                result.push(out);
            } else if (node.name === 'h2') {
                out = { kind: 'textelement', element: 'h1', text: this.paragraphs(node.children) };
                result.push(out);
            } else if (node.name === 'h3') {
                out = { kind: 'textelement', element: 'h2', text: this.paragraphs(node.children) };
                result.push(out);
            } else if (node.name === 'h4') {
                out = { kind: 'textelement', element: 'h3', text: this.paragraphs(node.children) };
                result.push(out);
            } else if (node.name === 'h5') {
                out = { kind: 'textelement', element: 'h4', text: this.paragraphs(node.children) };
                result.push(out);
            }
            if (filter !== [] && filter !== null && filter !== undefined) {
                let sectionFound = false;
                for (const section of filter) {
                    if (node.children[0].data === section) {
                        sectionFound = true;
                    }
                }
                if (sectionFound) {
                    result.pop();
                    const inter = this.recursive(node.parent);
                    if (inter && inter.length > 0) {
                        for (const temp of inter) {
                            result.push(temp);
                        }
                    }
                } else {
                    for (const child of node.children) {
                        const inter = this.recursive(child, filter);
                        if (inter && inter.length > 0) {
                            for (const temp of inter) {
                                result.push(temp);
                            }
                        }
                    }
                }
            } else {
                if (node.name === 'p') {
                    out = { kind: 'paragraph', text: this.paragraphs(node.children) };
                    result.push(out);
                } else if (node.name === 'a') {
                    out = { kind: 'link', ref: node.attribs.href, text: this.linkContent(node.children) };
                    result.push(out);
                } else if (node.name === 'img') {
                    const img: InlineImage = {
                        kind: 'inlineimage',
                        img: node.attribs.src,
                        title: node.attribs.alt,
                    };
                    result.push(img);
                } else if (node.name === 'table') {
                    out = { kind: 'table', content: this.table(node.children) };
                    result.push(out);
                } else if (node.name === 'ul') {
                    out = { kind: 'list', ordered: false, elements: this.list(node.children) };
                    result.push(out);
                } else if (node.name === 'code') {
                    out = { kind: 'code', content: node.children[0].data };
                    if (node.attribs['data-lang']) {
                        out.language = node.attribs['data-lang'];
                    }
                    result.push(out);
                } else if (node.name === 'br') {
                    const attrs: TextAttributes = { strong: false, cursive: false, underline: false, script: 'normal' };
                    const br: RichString = { text: '\n', attrs };
                    out = { kind: 'paragraph', text: [br] };
                    result.push(out);
                } else if (node.name === 'div' && node.attribs.class === 'content') {
                    out = { kind: 'paragraph', text: this.paragraphs(node.children) };
                    result.push(out);
                } else {
                    for (const child of node.children) {
                        const inter = this.recursive(child);
                        if (inter && inter.length > 0) {
                            for (const temp of inter) {
                                result.push(temp);
                            }
                        }
                    }
                }
            }
        }

        return result;
    }
    /**
     * linkContent
     * Create links with the differents parts of the file
     * @param {Array<any>} node
     * @returns {(Paragraph | InlineImage)}
     * @memberof ConfluenceTextIn
     */
    public linkContent(node: Array<any>): Paragraph | InlineImage {
        let result: Paragraph | InlineImage;
        if (node.length === 1 && node[0].name === 'img') {
            const img: InlineImage = {
                kind: 'inlineimage',
                img: node[0].attribs.src,
                title: node[0].attribs.alt,
            };
            result = img;
        } else {
            const out: Paragraph = { kind: 'paragraph', text: this.paragraphs(node) };
            result = out;
        }

        return result;
    }
    /**
     * list
     * If node received is a list, this method get all the elements in there and copy it in the final file.
     * @param {Array<any>} node
     * @returns {(Array<RichText | List | Paragraph | Link | Code>)}
     * @memberof ConfluenceTextIn
     */
    public list(node: Array<any>): Array<RichText | List | Paragraph | Link | Code> {
        const result: Array<RichText | List | Paragraph | Link | Code> = [];
        let out: RichText | List | Paragraph | Link | Code;
        for (const li of node) {
            if (li.name === 'li') {
                for (const child of li.children)
                    if (child.type === 'text' && child.data !== '\n') {
                        out = this.paragraphs([child]);
                        result.push(out);
                    } else if (child.name === 'ul') {
                        out = { kind: 'list', ordered: false, elements: this.list(child.children) };
                        result.push(out);
                    } else if (child.name === 'ol') {
                        out = { kind: 'list', ordered: true, elements: this.list(child.children) };
                        result.push(out);
                    } else if (child.name === 'p') {
                        out = { kind: 'paragraph', text: this.paragraphs(child.children) };
                        result.push(out);
                    } else if (child.name === 'div') {
                        for (const element of child.children) {
                            if (element.name === 'ol') {
                                out = { kind: 'list', ordered: true, elements: this.list(element.children) };
                                result.push(out);
                            } else if (element.name === 'ul') {
                                out = { kind: 'list', ordered: false, elements: this.list(element.children) };
                                result.push(out);
                            }
                        }
                    } else if (child.name === 'a') {
                        out = { kind: 'link', ref: child.attribs.href, text: this.linkContent(child.children) };
                        result.push(out);
                    } else if (child.name === 'code') {
                        out = { kind: 'code', content: child.children[0].data };
                        if (child.attribs['data-lang']) {
                            out.language = child.attribs['data-lang'];
                        }
                        result.push(out);
                    } else if (!child.data) {
                        out = this.paragraphs(child.children);
                        result.push(out);
                    }
            }
        }
        return result;
    }
    /**
     * table
     * If node received is a table, this method get all the elements in there and copy it in the final file.
     * @param {Array<any>} node
     * @returns {TableBody}
     * @memberof ConfluenceTextIn
     */
    public table(node: Array<any>): TableBody {

        let result: TableBody;
        const colspan: Array<Col> = [];
        const colRow: Array<Col> = [];
        const bodyRows: Array<Row> = [];

        for (const child of node) {
            if (child.name === 'tbody' || child.name === 'thead') {
                for (const row of child.children) {
                    if (row.name === 'tr') {
                        const resultRow: Row = [];
                        for (const cell of row.children) {
                            let element: Cell;
                            let colespan: string = '1';

                            if (cell.name === 'th') {
                                if (cell.attribs.colspan) {
                                    colespan = cell.attribs.colspan;
                                }
                                if (cell.children && cell.children.length > 0 && cell.children[0].name !== 'br') {
                                    const contentCell = this.tableTd(cell.children);
                                    if (contentCell) {
                                        element = { type: 'th', colspan: colespan, cell: contentCell };
                                        resultRow.push(element);
                                    }
                                } else {
                                    const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([{ data: ' ', type: 'text' }]) };
                                    element = { type: 'th', colspan: colespan, cell: [p] };
                                    resultRow.push(element);
                                }
                            } else if (cell.name === 'td') {
                                if (cell.attribs.colspan) {
                                    colespan = cell.attribs.colspan;
                                }
                                if (cell.children && cell.children.length > 0 && cell.children[0].name !== 'br') {
                                    const contentCell = this.tableTd(cell.children);
                                    if (contentCell) {
                                        element = { type: 'td', colspan: colespan, cell: contentCell };
                                        resultRow.push(element);
                                    }
                                } else {
                                    const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([{ data: ' ', type: 'text' }]) };
                                    element = { type: 'td', colspan: colespan, cell: [p] };
                                    resultRow.push(element);
                                }
                            }
                        }
                        bodyRows.push(resultRow);
                    }
                }

            } else if (child.name === 'colgroup') {
                for (const col of child.children) {
                    let element: Col;
                    let colespan: string = '\\"1\\"';

                    if (col.name === 'col') {
                        if (col.attribs.colespan) {
                            colespan = col.attribs.colespan;
                        }

                        element = {
                            span: colespan,
                            style: col.attribs.style,
                        };
                        colRow.push(element);
                    }
                }
            } else if (child.name === 'tr') {
                const resultRow: Row = [];
                for (const cell of child.children) {
                    let element: Cell;
                    let colespan: string = '1';

                    if (cell.name === 'th') {
                        if (cell.attribs.colspan) {
                            colespan = cell.attribs.colspan;
                        }
                        if (cell.children && cell.children.length > 0 && cell.children[0].name !== 'br') {
                            const contentCell = this.tableTd(cell.children);
                            if (contentCell) {
                                element = { type: 'th', colspan: colespan, cell: contentCell };
                                resultRow.push(element);
                            }
                        } else {
                            const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([{ data: ' ', type: 'text' }]) };
                            element = { type: 'th', colspan: colespan, cell: [p] };
                            resultRow.push(element);
                        }
                    } else if (cell.name === 'td') {
                        if (cell.attribs.colspan) {
                            colespan = cell.attribs.colspan;
                        }
                        if (cell.children && cell.children.length > 0 && cell.children[0].name !== 'br') {
                            const contentCell = this.tableTd(cell.children);
                            if (contentCell) {
                                element = { type: 'td', colspan: colespan, cell: contentCell };
                                resultRow.push(element);
                            }
                        } else {
                            const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([{ data: ' ', type: 'text' }]) };
                            element = { type: 'td', colspan: colespan, cell: [p] };
                            resultRow.push(element);
                        }
                    }
                }
                bodyRows.push(resultRow);
            }
        }

        result = {
            colgroup: colRow,
            body: bodyRows,
        };

        return result;
    }
    /**
     * tableTD
     *  If node received is a table, this method get all the elements in there and copy it in the final file.
     * @param {*} node
     * @returns {Array<TableSegment>}
     * @memberof ConfluenceTextIn
     */
    public tableTd(node: any): Array<TableSegment> {
        const result: Array<TableSegment> = [];
        for (const child of node) {
            let out: TableSegment;
            if (child.name === 'p') {
                out = { kind: 'paragraph', text: this.paragraphs(child.children) };
                result.push(out);
            } else if (child.name === 'img') {
                const img: InlineImage = { kind: 'inlineimage', img: child.attribs.src, title: child.attribs.alt };
                result.push(img);
            } else if (child.name === 'table') {
                out = { kind: 'table', content: this.table(child.children) };
                result.push(out);
            } else if (child.name === 'span') {
                out = { kind: 'paragraph', text: this.paragraphs(child.children) };
                result.push(out);
            } else if (child.name === 'ul') {
                out = { kind: 'list', ordered: false, elements: this.list(child.children) };
                result.push(out);
            } else if (child.name === 'ol') {
                out = { kind: 'list', ordered: true, elements: this.list(child.children) };
                result.push(out);
            } else if (node.name === 'a') {
                out = { kind: 'link', ref: node.attribs.href, text: this.linkContent(node.children) };
                result.push(out);
            } else if (node.name === 'code') {

                out = { kind: 'code', content: node.children[0].data };
                if (node.attribs['data-lang']) {
                    out.language = node.attribs['data-lang'];
                }
                result.push(out);

            } else if (child.name === 'div') {
                if (child.children) {
                    for (const element of child.children) {
                        if (element.children) {
                            const temp: Array<TableSegment> = this.tableTd(element.children);
                            for (const inside of temp) {
                                result.push(inside);
                            }
                        } else if (element.type === 'text') {
                            const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([element]) };
                            result.push(p);
                        }
                    }
                }
            } else if ((child.type === 'text' && child.data !== '\n') || (child.type === 'tag')) {
                const p: Paragraph = { kind: 'paragraph', text: this.paragraphs([child]) };
                result.push(p);
            }
        }

        return result;
    }
    /**
     * paragraphs
     * If node received is a paragraph, this method get all the elements in there and copy it in the final file.
     * @param {Array<any>} node
     * @returns {RichText}
     * @memberof ConfluenceTextIn
     */
    public paragraphs(node: Array<any>): RichText {

        const result: RichText = [];
        for (const child of node) {
            if (child.name === 'img') {
                const img: InlineImage = {
                    kind: 'inlineimage',
                    img: child.attribs.src,
                    title: child.attribs.alt,
                };
                result.push(img);
            } else if (child.name === 'a') {
                const out: Link = { kind: 'link', ref: child.attribs.href, text: this.linkContent(child.children) };
                result.push(out);
            } else if (child.name === 'br') {
                const attrs: TextAttributes = { strong: false, cursive: false, underline: false, script: 'normal' };
                const out: RichString = { text: '\n', attrs };
                result.push(out);
            } else if (child.name === 'code') {
                const out: Code = { kind: 'code', content: child.children[0].data };
                if (child.attribs['data-lang']) {
                    out.language = child.attribs['data-lang'];
                }
                result.push(out);
            } else if (child.children) {
                let para: Array<RichString | InlineImage | Link | Table | Code> = this.paragraphs(child.children);
                if (child.name) {
                    const newParam = child;
                    if (child.name === 'span' && child.attribs.class === 'underline') {
                        newParam.name = 'underline';
                    }
                    para = this.putMyAttribute((para as Array<RichString>), newParam.name);
                }
                if (para && para.length > 0) {
                    for (const temp of para) {
                        result.push(temp);
                    }
                }

            } else if (child.type === 'text' && child.data !== '' && child.data !== ' ') {
                const attrs: TextAttributes = { strong: false, cursive: false, underline: false, script: 'normal' };
                const out: RichString = { text: child.data, attrs };
                result.push(out);
            }
        }
        return result;

    }
    /**
     * putMyAttribute
     * Write the different attributes on the paragraph
     * @param {Array<RichString>} para
     * @param {string} myParam
     * @returns {Array<RichString>}
     * @memberof ConfluenceTextIn
     */
    public putMyAttribute(para: Array<RichString>, myParam: string): Array<RichString> {
        const paragraph: Array<RichString> = [];
        for (const par of para) {
            if (myParam === 'strong') {
                par.attrs.strong = true;
            } else if (myParam === 'em') {
                par.attrs.cursive = true;
            } else if (myParam === 'underline') {
                par.attrs.underline = true;
            } else if (myParam === 'sub') {
                par.attrs.script = 'sub';
            } else if (myParam === 'sup') {
                par.attrs.script = 'super';
            }
            paragraph.push(par);
        }
        return paragraph;
    }

}