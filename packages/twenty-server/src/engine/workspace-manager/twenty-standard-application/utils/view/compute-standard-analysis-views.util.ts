import { ViewType, ViewKey } from 'twenty-shared/types';

import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';

import {
  createStandardViewFlatMetadata,
  type CreateStandardViewArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view/create-standard-view-flat-metadata.util';

export const computeStandardAnalysisViews = (
  args: Omit<CreateStandardViewArgs<'analysis'>, 'context'>,
): Record<string, FlatView> => {
  return {
    allAnalyses: createStandardViewFlatMetadata({
      ...args,
      objectName: 'analysis',
      context: {
        viewName: 'allAnalyses',
        name: 'All {objectLabelPlural}',
        type: ViewType.TABLE,
        key: ViewKey.INDEX,
        position: 0,
        icon: 'IconList',
      },
    }),
    analysisRecordPageFields: createStandardViewFlatMetadata({
      ...args,
      objectName: 'analysis',
      context: {
        viewName: 'analysisRecordPageFields',
        name: 'Analysis Record Page Fields',
        type: ViewType.FIELDS_WIDGET,
        key: null,
        position: 0,
        icon: 'IconList',
      },
    }),
  };
};
