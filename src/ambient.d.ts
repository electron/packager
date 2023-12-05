declare module 'get-package-info' {
  type Props = Array<string | string[]>

  export type GetPackageInfoResultSourceItem = {
    /** path to the package.json file */
    src: string

    /** property name */
    prop: string

    /** the `package.json` object */
    pkg: Record<string, unknown>
  }

  export type GetPackageInfoResult = {
    source: Record<string, GetPackageInfoResultSourceItem>
    values: Record<string, unknown>
  }

  function getPackageInfo (props: Props, dir: string): Promise<GetPackageInfoResult>

  export type GetPackageInfoError = Error & {
    missingProps: Props
    result: GetPackageInfoResult
  }

  export = getPackageInfo
}
