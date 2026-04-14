declare module 'get-package-info' {
  type Props = Array<string | string[]>;

  type GetPackageInfoResultSourceItem = {
    /** path to the package.json file */
    src: string;

    /** property name */
    prop: string;

    /** the `package.json` object */
    pkg: Record<string, unknown>;
  };

  type GetPackageInfoResult = {
    source: Record<string, GetPackageInfoResultSourceItem>;
    values: Record<string, unknown>;
  };

  type GetPackageInfoError = Error & {
    missingProps: Props;
    result: GetPackageInfoResult;
  };

  function getPackageInfo(props: Props, dir: string): Promise<GetPackageInfoResult>;

  namespace getPackageInfo {
    export { GetPackageInfoResultSourceItem, GetPackageInfoResult, GetPackageInfoError };
  }

  export = getPackageInfo;
}
