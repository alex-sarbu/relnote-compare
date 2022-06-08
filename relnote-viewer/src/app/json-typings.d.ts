interface relnoteline {
    ref: string,
    cat: string,
    summary: string,
    details: string
}

declare module "*.json" {
    const value: {version: string, items: relnoteline[]}[];
    export default value;
    }
     