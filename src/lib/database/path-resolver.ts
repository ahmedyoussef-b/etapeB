export interface DataPath {
  type: 'block' | 'equipment' | 'subsystem' | 'systemEquipment' | 'group' | 'groupEquipment' | 'procedure' | 'user' | 'team' | 'report' | 'system' | 'registry' | 'index' | 'mirror' | 'qr';
  id?: string;
  subPath?: string;
  entityType?: 'image' | 'video' | 'document' | 'signature';
  year?: string;
  month?: string;
  block?: string;
  equipmentCode?: string;
  subsystemCode?: string;
  groupName?: string;
  fileName?: string;
}

export class PathResolver {
  private static readonly INDEXES = 'indexes';

  static resolve(path: DataPath): string {
    const parts: string[] = [];

    switch (path.type) {
      case 'block':
        parts.push('Centrale');
        if (path.block) parts.push(path.block);
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'equipment':
        parts.push('Centrale', path.block || '');
        if (path.subsystemCode) parts.push(path.subsystemCode);
        if (path.equipmentCode) parts.push(path.equipmentCode);
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'subsystem':
        parts.push('Centrale', path.block || '', path.equipmentCode || '');
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'systemEquipment':
        parts.push('Centrale', path.block || '');
        if (path.subsystemCode) parts.push(path.subsystemCode);
        if (path.equipmentCode) parts.push(path.equipmentCode);
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'group':
        parts.push('Groupes');
        if (path.groupName) parts.push(path.groupName);
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'groupEquipment':
        parts.push('Groupes', path.groupName || '', path.equipmentCode || '');
        if (path.subPath) parts.push(path.subPath);
        else parts.push('.meta.json');
        break;

      case 'procedure':
        parts.push('registry', 'procedures');
        if (path.id) {
          parts.push(path.id);
          if (path.subPath) parts.push(path.subPath);
        } else if (path.subPath) {
          parts.push(path.subPath);
        }
        break;

      case 'user':
        parts.push('registry', 'items');
        if (path.id) {
          parts.push(path.id);
          if (path.subPath) parts.push(path.subPath);
        }
        break;

      case 'team':
        parts.push('registry', 'ressources humaines');
        if (path.id) {
          parts.push(`equipe ${path.id}`);
          if (path.subPath) parts.push(path.subPath);
        }
        break;

      case 'report':
        parts.push('registry', 'reports');
        if (path.id) {
          parts.push(path.id);
          if (path.subPath) parts.push(path.subPath);
        }
        break;

      case 'system':
        parts.push('registry', 'system');
        if (path.subPath) parts.push(path.subPath);
        break;

      case 'registry':
        parts.push('registry');
        if (path.subPath) parts.push(path.subPath);
        break;

      case 'index':
        parts.push(this.INDEXES);
        if (path.fileName) parts.push(path.fileName);
        else if (path.id) parts.push(`${path.id}.json`);
        else if (path.subPath) parts.push(path.subPath);
        break;

      case 'mirror':
        parts.push('mirror_repertoire.json');
        break;

      case 'qr':
        parts.push('Centrale', path.block || '', path.equipmentCode || '', 'data', 'qr');
        if (path.subPath) parts.push(path.subPath);
        break;

      default:
        throw new Error(`Type de chemin non supporté: ${(path as any).type}`);
    }

    return parts.join('/').replace(/\/+/g, '/');
  }

  static resolveIndex(type: string): string {
    return `${this.INDEXES}/${type}.json`;
  }

  static getBlockPath(block: string, subPath?: string): DataPath {
    return { type: 'block', block, subPath };
  }

  static getEquipmentPath(block: string, equipmentCode: string, subPath?: string): DataPath {
    return { type: 'equipment', block, equipmentCode, subPath };
  }

  static getSubsystemPath(block: string, subsystemCode: string, subPath?: string): DataPath {
    return { type: 'subsystem', block, equipmentCode: subsystemCode, subPath };
  }

  static getSystemEquipmentPath(block: string, subsystemCode: string, equipmentCode: string, subPath?: string): DataPath {
    return { type: 'systemEquipment', block, subsystemCode, equipmentCode, subPath };
  }

  static getGroupPath(groupName: string, subPath?: string): DataPath {
    return { type: 'group', groupName, subPath };
  }

  static getGroupEquipmentPath(groupName: string, equipmentCode: string, subPath?: string): DataPath {
    return { type: 'groupEquipment', groupName, equipmentCode, subPath };
  }

  static getProcedurePath(id: string, subPath?: string): DataPath {
    return { type: 'procedure', id, subPath };
  }

  static getUserPath(id: string, subPath?: string): DataPath {
    return { type: 'user', id, subPath };
  }

  static getTeamPath(id: string, subPath?: string): DataPath {
    return { type: 'team', id, subPath };
  }

  static getReportPath(id: string, subPath?: string): DataPath {
    return { type: 'report', id, subPath };
  }

  static getIndexPath(indexName: string): DataPath {
    return { type: 'index', id: indexName, fileName: `${indexName}.json` };
  }

  static getQrPath(block: string, equipmentCode: string, fileName?: string): DataPath {
    return { type: 'qr', block, equipmentCode, subPath: fileName };
  }
}
