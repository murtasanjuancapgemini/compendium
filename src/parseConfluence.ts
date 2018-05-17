import { ParseLocal } from './parseLocal';
import { Credentials, Cookies, ConfluenceService } from './types';
import { ConfluenceServiceImpl } from './confluenceService';
import * as fs from 'fs';
import * as util from 'util';
import * as extrafs from 'fs-extra';
import * as shelljs from 'shelljs';
import * as imagemagick from 'imagemagick';

export class ParseConfluence extends ParseLocal {
  public static auth: Cookies | Credentials;
  public static confluenceService: ConfluenceService;
  public static baseURL: string;

  public static init(auth: Cookies | Credentials, baseURL: string) {
    this.auth = auth;
    this.baseURL = baseURL;
    //Confluence Service
    this.confluenceService = new ConfluenceServiceImpl();
  }

  /**
   * copyImagenot implemented yet
   * @param {string} dir
   * @memberof ParseConfluence
   */
  public static async copyImage(dir: string) {
    if (dir.includes('http')) {
      //create folder imageTemp if not exists
      try {
        await extrafs.ensureDir('imageTemp/images/');
      } catch (error) {
        console.log(error);
      }

      //get content json
      let content;
      let error = false;
      try {
        content = await this.confluenceService.getImage(dir, this.auth);
      } catch (err) {
        if (err.message) {
          throw new Error(err.message);
        } else {
          throw new Error(
            "It isn't possible to get the content from confluence",
          );
        }
      }
      //get image size before to include the size in the src
      /* let imagesize = await this.getImageSize(dir);
      console.log(imagesize); */

      //write image in the folder imageTemp
      if (content) {
        let folder = 'imageTemp/images/';
        let filename = this.getPath(dir);
        let src = folder.concat(filename);
        try {
          await extrafs.writeFile(src, content);
        } catch (err) {
          if (
            err.code !== 'ENOENT' &&
            err.code !== 'ENOTEMPTY' &&
            err.code !== 'EBUSY'
          )
            console.log(err.message);
        }
      }
    }
  }
  /** get the file name and extension
   * @param {string} dir
   * @memberof ParseConfluence
   */
  public static getPath(dir: string): string {
    //extension
    let extension: string = '';
    if (dir.includes('.jpg')) extension = 'jpg';
    if (dir.includes('.png')) extension = 'png';
    if (dir.includes('jpeg')) extension = 'jpeg';
    if (extension === '')
      throw new Error(
        'The image url does not contain an implemented extension',
      );
    //image number
    let arrayAux = dir.split('/');
    let filename = arrayAux[arrayAux.length - 2];
    //path
    let path = filename.concat('.', extension);

    return path;
  }
  /**
   * change the image src when downloading
   *
   * @param {string} dir
   * @memberof ParseLocal overwriting
   */
  public static changeSRC(name: string): string {
    if (name.includes('http')) {
      let folder = 'images/';
      let filename = this.getPath(name);
      let src = folder.concat(filename);
      return src;
    } else {
      return name;
    }
  }
  /* getting ready for a Confluence api request
  * return the uri given image http path
  */
  private static createUriImage(id: string): string {
    let outputURI = '';

    if (id !== '') {
      outputURI = this.baseURL + `rest/api/content/${id}/child/attachment`;
    } else {
      throw new Error('CreateURI: id cannot be blank');
    }
    return outputURI;
  }
  /*
  * return the id numer of the given image http path
  */
  public static getId(dir: string): string {
    //image number
    let arrayAux = dir.split('/');
    let filename = arrayAux[arrayAux.length - 2];
    return filename;
  }
  /* async method
  * return the size of the image given image http path
  * throughout a request to the confluence api
  */
  public static async getImageSize(dir: string): Promise<string> {
    let imageId = this.getId(dir);
    let uri = this.createUriImage(imageId);
    let content = await this.confluenceService.getContent(uri, this.auth);
    const parsed_content = JSON.parse(JSON.stringify(content));
    let filesize = parsed_content.results[0].extensions.fileSize;

    return filesize;
  }
}
