const l10n = require("../helpers/l10n").default;

const id = "EVENT_KANTO_MENU";
const groups = ["EVENT_GROUP_DIALOGUE"];

const autoLabel = (fetchArg) => {
  const numItems = parseInt(fetchArg("items"));
  const text = Array(numItems)
    .fill()
    .map((_, i) => {
      return `"${fetchArg(`option${i + 1}`)}"`;
    })
    .join();
  return l10n("EVENT_MENU_LABEL", {
    variable: fetchArg("variable"),
    text,
  });
};

const fields = [].concat(
  [
    {
      label: l10n("FIELD_TEXT_IN_LOGO_WARNING"),
      labelVariant: "warning",
      flexBasis: "100%",
      conditions: [
        {
          sceneType: ["logo"],
        },
      ],
    },
    {
      key: "variable",
      label: l10n("FIELD_SET_VARIABLE"),
      description: l10n("FIELD_VARIABLE_DESC"),
      type: "variable",
      defaultValue: "LAST_VARIABLE",
    },
    {
      key: "items",
      label: l10n("FIELD_NUMBER_OF_OPTIONS"),
      description: l10n("FIELD_NUMBER_OF_OPTIONS_DESC"),
      type: "number",
      min: 2,
      max: 8,
      defaultValue: 2,
    },
    {
      type: "break",
    },
  ],
  Array(8)
    .fill()
    .reduce((arr, _, i) => {
      const value = i + 1;
      arr.push(
        {
          key: `option${i + 1}`,
          label: l10n("FIELD_SET_TO_VALUE_IF", { value: String(i + 1) }),
          description: l10n("FIELD_SET_TO_VALUE_IF_MENU_DESC", {
            value: String(i + 1),
          }),
          hideFromDocs: i >= 2,
          type: "textarea",
          singleLine: true,
          defaultValue: "",
          placeholder: l10n("FIELD_ITEM", { value: String(i + 1) }),
          conditions: [
            {
              key: "items",
              gt: value,
            },
          ],
        },
        {
          key: `option${i + 1}`,
          label: l10n("FIELD_SET_TO_VALUE_IF", { value: String(i + 1) }),
          description: l10n("FIELD_SET_TO_VALUE_IF_MENU_DESC", {
            value: String(i + 1),
          }),
          hideFromDocs: i >= 2,
          type: "textarea",
          singleLine: true,
          defaultValue: "",
          placeholder: l10n("FIELD_ITEM", { value: String(i + 1) }),
          conditions: [
            {
              key: "items",
              eq: value,
            },
            {
              key: "cancelOnLastOption",
              ne: true,
            },
          ],
        },
        {
          key: `option${i + 1}`,
          label: l10n("FIELD_SET_TO_VALUE_IF", { value: "0" }),
          description: l10n("FIELD_SET_TO_VALUE_IF_MENU_DESC", { value: "0" }),
          hideFromDocs: true,
          type: "textarea",
          singleLine: true,
          defaultValue: "",
          placeholder: l10n("FIELD_ITEM", { value: String(i + 1) }),
          conditions: [
            {
              key: "items",
              eq: value,
            },
            {
              key: "cancelOnLastOption",
              eq: true,
            },
          ],
        },
      );
      return arr;
    }, []),
  {
    type: "break",
  },
  {
    type: "checkbox",
    label: l10n("FIELD_LAST_OPTION_CANCELS"),
    description: l10n("FIELD_LAST_OPTION_CANCELS_DESC"),
    key: "cancelOnLastOption",
  },
  {
    type: "checkbox",
    label: l10n("FIELD_CANCEL_IF_B"),
    description: l10n("FIELD_CANCEL_IF_B_DESC"),
    key: "cancelOnB",
    defaultValue: true,
  },
  {
    key: "layout",
    type: "select",
    label: l10n("FIELD_LAYOUT"),
    description: l10n("FIELD_LAYOUT_MENU_DESC"),
    options: [
      ["dialogue", l10n("FIELD_LAYOUT_DIALOGUE")],
      ["menu", l10n("FIELD_LAYOUT_MENU")],
    ],
    defaultValue: "dialogue",
  },
);

const compile = (input, helpers) => {
  const options = [
    input.option1, input.option2, input.option3, input.option4,
    input.option5, input.option6, input.option7, input.option8,
  ].splice(0, input.items);

  // Keep the native dialogue layout, including its two-column navigation.
  if (input.layout !== "menu") {
    helpers.textMenu(input.variable, options, input.layout,
      input.cancelOnLastOption, input.cancelOnB);
    return;
  }

  // GB Studio 4.3.2 single-column menu sequence, with only width/x changed.
  // Full-width windows use the engine's existing scanline sprite occlusion.
  const variableAlias = helpers.getVariableAlias(input.variable);
  const optionsText = options.map((option, index) =>
    "\\002\\001" + (option || `Item ${index + 1}`));
  const menuText = "\\001\\001\\003\\003\\002" + optionsText.join("\n");
  const height = options.length;
  const x = 0;
  const choiceFlags = [];
  if (input.cancelOnLastOption) choiceFlags.push(".UI_MENU_LAST_0");
  if (input.cancelOnB) choiceFlags.push(".UI_MENU_CANCEL_B");

  helpers._addComment("Text Menu");
  let dest = variableAlias;
  if (helpers._isIndirectVariable(input.variable)) {
    dest = helpers._declareLocal("menu_result", 1, true);
  }
  helpers._overlayClear(0, 0, 20, height + 2, ".UI_COLOR_WHITE", true, true);
  helpers._overlayMoveTo(x, 18, ".OVERLAY_SPEED_INSTANT");
  helpers._overlayMoveTo(x, 18 - height - 2, ".OVERLAY_IN_SPEED");
  helpers._setTextLayer(".TEXT_LAYER_WIN");
  helpers._loadAndDisplayText(menuText);
  helpers._overlayWait(true, [".UI_WAIT_WINDOW", ".UI_WAIT_TEXT"]);
  helpers._choice(dest, choiceFlags, options.length);
  const clampedMenuIndex = index =>
    index < 0 || index > options.length - 1 ? 0 : index + 1;
  for (let i = 0; i < options.length; i++) {
    helpers._menuItem(1, 1 + i, 1, options.length,
      clampedMenuIndex(i - 1), clampedMenuIndex(i + 1));
  }
  helpers._overlayMoveTo(x, 18, ".OVERLAY_OUT_SPEED");
  helpers._overlayWait(true, [".UI_WAIT_WINDOW", ".UI_WAIT_TEXT"]);
  helpers._overlayMoveTo(0, 18, ".OVERLAY_SPEED_INSTANT");
  if (helpers._isIndirectVariable(input.variable)) {
    helpers._setInd(variableAlias, dest);
  }
  helpers._addNL();
};

module.exports = {
  id,
  description: l10n("EVENT_MENU_DESC"),
  autoLabel,
  groups,
  fields,
  compile,
  waitUntilAfterInitFade: true,
};
