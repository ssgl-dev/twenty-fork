import {
  STANDARD_OBJECTS,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-shared/metadata';
import { PageLayoutTabLayoutMode } from 'twenty-shared/types';

import { PageLayoutType } from 'src/engine/metadata-modules/page-layout/enums/page-layout-type.enum';
import {
  TAB_PROPS,
  WIDGET_PROPS,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout-tabs.template';
import {
  type StandardPageLayoutConfig,
  type StandardPageLayoutTabConfig,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/page-layout-config/standard-page-layout-config.type';

// The Home tab intentionally has no widgets: it is pinned as the record page
// left panel (showing only the record SummaryCard). The analysis metadata
// (fields) lives on the "Details" tab so it is only shown on demand. The
// Files tab comes before Details so it is the default (clean) view.
const ANALYSIS_PAGE_TABS = {
  home: {
    universalIdentifier:
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage.tabs.home
        .universalIdentifier,
    ...TAB_PROPS.home,
    widgets: {},
  },
  files: {
    universalIdentifier:
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage.tabs.files
        .universalIdentifier,
    ...TAB_PROPS.files,
    position: 20,
    widgets: {
      files: {
        universalIdentifier:
          STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage.tabs
            .files.widgets.files.universalIdentifier,
        ...WIDGET_PROPS.files,
      },
    },
  },
  details: {
    universalIdentifier:
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage.tabs.details
        .universalIdentifier,
    title: 'Details',
    position: 30,
    icon: 'IconInfoCircle',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: {
      fields: {
        universalIdentifier:
          STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage.tabs
            .details.widgets.fields.universalIdentifier,
        ...WIDGET_PROPS.fields,
      },
    },
  },
} as const satisfies Record<string, StandardPageLayoutTabConfig>;

export const STANDARD_ANALYSIS_PAGE_LAYOUT_CONFIG = {
  name: 'Default Analysis Layout',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: STANDARD_OBJECTS.analysis.universalIdentifier,
  universalIdentifier:
    STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.analysisRecordPage
      .universalIdentifier,
  defaultTabUniversalIdentifier: null,
  tabs: ANALYSIS_PAGE_TABS,
} as const satisfies StandardPageLayoutConfig;
