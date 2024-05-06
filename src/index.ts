import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageName = process.env.NPM_PINNER_PACKAGE_NAME ?? process.argv[2];
const packageVersion =
  process.env.NPM_PINNER_PACKAGE_VERSION ?? process.argv[3];

if (packageName == null) {
  throw new Error('Missing: <package-name> argument');
}
if (packageVersion == null) {
  throw new Error('Missing: <package-version> argument');
}

console.log(`Package: ${packageName}@${packageVersion}`);

const __filename = import.meta.url;
const __dirname = path.dirname(fileURLToPath(__filename));

const outDirName = path.join(__dirname, '..', 'out');
if (!fs.existsSync(outDirName)) {
  fs.mkdirSync(outDirName);
}

const infoFileName = path.join(outDirName, 'package-info.json');
const pinnedVersionsFileName = path.join(outDirName, 'pinned-versions.json');

interface PackageInfo {
  name: string;
  time: Date;
  version: string;
}

interface NpmPackageRecord {
  name: string;
  time: Record<string, string>;
  versions: Record<string, { dependencies: unknown[] }>;
}

const packageVersionInfo = await getPackageVersionInfo({
  name: packageName,
  version: packageVersion,
});

if (packageVersionInfo == null) {
  throw new Error('Failed to get package version info');
}

// new Date(1704846558567),
const packageInfos = await getLatestInfoAtTime(packageVersionInfo);
packageInfos.sort((a, b) => a.name.localeCompare(b.name));

const pinnedVersions = packageInfos.reduce((memo, info) => {
  memo[info.name] = info.version;
  return memo;
}, {} as Record<string, string>);

fs.writeFileSync(infoFileName, JSON.stringify(packageInfos, null, 2));
fs.writeFileSync(
  pinnedVersionsFileName,
  JSON.stringify(pinnedVersions, null, 2)
);

async function getPackageVersionInfo({
  name,
  version,
}: {
  name: string;
  version: string;
}): Promise<PackageInfo | null> {
  const json = await fetchNpmJson<NpmPackageRecord>(name);

  if (json == null) {
    return null;
  }

  const time = json.time[version];
  if (time == null) {
    return null;
  }

  return {
    name,
    time: new Date(time),
    version,
  };
}

async function getLatestInfoAtTime({
  name,
  time,
}: {
  name: string;
  time: Date;
}): Promise<PackageInfo[]> {
  const packageInfos: PackageInfo[] = [];
  const queue = [name];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const promises = queue.map(name => fetchNpmJson<NpmPackageRecord>(name));
    queue.length = 0;

    const jsons = await Promise.all(promises);

    jsons.forEach(json => {
      if (json == null) {
        return;
      }

      const timeMap = Object.entries(json.time)
        .map(([key, value]) => ({ time: new Date(value), version: key }))
        .filter(({ version }) => /^\d+\.\d+\.\d+$/.test(version))
        .sort(({ time: t1 }, { time: t2 }) => t2.valueOf() - t1.valueOf());

      const latestMatchingVersionInfo = timeMap.find(
        ({ time: t }) => t <= time
      );

      if (latestMatchingVersionInfo == null) {
        return;
      }

      packageInfos.push({
        name: json.name,
        ...latestMatchingVersionInfo,
      });

      const dependencies =
        json.versions[latestMatchingVersionInfo.version].dependencies ?? {};
      const toAdd = Object.keys(dependencies).filter(
        name => !visited.has(name)
      );
      toAdd.forEach(n => {
        visited.add(n);
      });
      queue.push(...toAdd);
    });
  }

  return packageInfos;
}

async function fetchNpmJson<T>(path: string) {
  console.log(`Fetching info for npm package: ${path}`);
  try {
    const result = await fetch(`https://registry.npmjs.org/${path}`);
    return result.json() as Promise<T>;
  } catch (err) {
    console.error(`Failed to fetch npm package info: ${path}`, err);
  }
}
