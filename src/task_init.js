const exec = require('child_process').execSync;
const fs = require('fs');




vmake.tasks.init = function () {
  vmake.mkdirs("src");

  if (!fs.existsSync("vmake.js"))
    fs.writeFileSync("vmake.js", `// more help: https://github.com/dyesorrow/vmake
vmake.target("app", "bin", (dest) => {
    dest.add_cxxflag("-g");
    dest.add_cxxflag("-std=c++17");
    dest.add_cxxflag("-Wall");
    dest.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    dest.add_cxxflag("-finput-charset=UTF-8");
    dest.add_cxxflag("-Wextra");

    dest.add_package("${vmake.get_config("repo", "http://localhost:19901/vmake-repo")}", {
      "log": "1.0.0",
      "json": "1.0.0",
    });

    dest.add_define("__DEBUG__");
    dest.add_include("src");
    dest.add_files("src/*.cpp");
    // dest.add_objs("res/icon/icon.o");

    dest.add_ldflag("-static -pthread");
    // dest.add_ldflag("-ldl -lrt -pthread -Wl,--whole-archive -lpthread -Wl,--no-whole-archive");

    // dest.add_before(()=>{
    //     console.log("todo something");
    // });

    dest.add_after(() => {
        vmake.copy(dest.dir() + "/app", "bin/app");
    });
}); 
`);

  if (!fs.existsSync(".clang-format"))
    fs.writeFileSync(".clang-format", `---
# https://clang.llvm.org/docs/ClangFormatStyleOptions.html
# 语言: None, Cpp, Java, JavaScript, ObjC, Proto, TableGen, TextProto
#    // clang-format off
#    // clang-format on
Language:        Cpp
# BasedOnStyle:  Google
# 访问说明符(public、private等)的偏移
AccessModifierOffset: -4
# 开括号(开圆括号、开尖括号、开方括号)后的对齐: Align, DontAlign, AlwaysBreak(总是在开括号后换行)
AlignAfterOpenBracket: DontAlign
# 连续赋值时，对齐所有等号
AlignConsecutiveAssignments: false

AlignConsecutiveMacros: false
# 连续声明时，对齐所有声明的变量名
AlignConsecutiveDeclarations: false
# 左对齐逃脱换行(使用反斜杠换行)的反斜杠
AlignEscapedNewlines: Left
# 水平对齐二元和三元表达式的操作数
AlignOperands:   true
AlignTrailingComments: true
AllowAllArgumentsOnNextLine: true
AllowAllConstructorInitializersOnNextLine: false
AllowAllParametersOfDeclarationOnNextLine: true
AllowShortBlocksOnASingleLine: false
AllowShortCaseLabelsOnASingleLine: false
AllowShortFunctionsOnASingleLine: All
AllowShortLambdasOnASingleLine: Empty
AllowShortIfStatementsOnASingleLine: WithoutElse
AllowShortLoopsOnASingleLine: false
AlwaysBreakAfterDefinitionReturnType: None
AlwaysBreakAfterReturnType: None
AlwaysBreakBeforeMultilineStrings: true
AlwaysBreakTemplateDeclarations: No
BinPackArguments: false
BinPackParameters: true
BraceWrapping:
  AfterCaseLabel:  false
  AfterClass:      false
  AfterControlStatement: false
  AfterEnum:       false
  AfterFunction:   false
  AfterNamespace:  true
  AfterObjCDeclaration: false
  AfterStruct:     false
  AfterUnion:      false
  AfterExternBlock: false
  BeforeCatch:     false
  BeforeElse:      false
  IndentBraces:    false
  SplitEmptyFunction: true
  SplitEmptyRecord: true
  SplitEmptyNamespace: true
BreakBeforeBinaryOperators: None
BreakBeforeBraces: Attach
BreakBeforeInheritanceComma: false
BreakInheritanceList: BeforeColon
BreakBeforeTernaryOperators: true
BreakConstructorInitializersBeforeComma: false
BreakConstructorInitializers: BeforeColon
BreakAfterJavaFieldAnnotations: false
BreakStringLiterals: true
ColumnLimit:     0
CommentPragmas:  '^ IWYU pragma:'
CompactNamespaces: false
ConstructorInitializerAllOnOneLineOrOnePerLine: false
ConstructorInitializerIndentWidth: 4
ContinuationIndentWidth: 4
Cpp11BracedListStyle: true
DerivePointerAlignment: true
DisableFormat:   false
ExperimentalAutoDetectBinPacking: false
FixNamespaceComments: false
ForEachMacros:
  - foreach
  - Q_FOREACH
  - BOOST_FOREACH
IncludeBlocks:   Regroup
IncludeCategories:
  - Regex:           '^<ext/.*\.h>'
    Priority:        2
  - Regex:           '^<.*\.h>'
    Priority:        1
  - Regex:           '^<.*'
    Priority:        2
  - Regex:           '.*'
    Priority:        3
IncludeIsMainRegex: '([-_](test|unittest))?$'
IndentCaseLabels: true
IndentPPDirectives: None
IndentWidth:     4
IndentWrappedFunctionNames: false
JavaScriptQuotes: Leave
JavaScriptWrapImports: true
KeepEmptyLinesAtTheStartOfBlocks: false
MacroBlockBegin: ''
MacroBlockEnd:   ''
MaxEmptyLinesToKeep: 1
NamespaceIndentation: None
ObjCBinPackProtocolList: Never
ObjCBlockIndentWidth: 4
ObjCSpaceAfterProperty: false
ObjCSpaceBeforeProtocolList: true
PenaltyBreakAssignment: 4
PenaltyBreakBeforeFirstCallParameter: 4
PenaltyBreakComment: 300
PenaltyBreakFirstLessLess: 120
PenaltyBreakString: 1000
PenaltyBreakTemplateDeclaration: 10
PenaltyExcessCharacter: 1000000
PenaltyReturnTypeOnItsOwnLine: 200
PointerAlignment: Left
RawStringFormats:
  - Language:        Cpp
    Delimiters:
      - cc
      - CC
      - cpp
      - Cpp
      - CPP
      - 'c++'
      - 'C++'
    CanonicalDelimiter: ''
    BasedOnStyle:    google
  - Language:        TextProto
    Delimiters:
      - pb
      - PB
      - proto
      - PROTO
    EnclosingFunctions:
      - EqualsProto
      - EquivToProto
      - PARSE_PARTIAL_TEXT_PROTO
      - PARSE_TEST_PROTO
      - PARSE_TEXT_PROTO
      - ParseTextOrDie
      - ParseTextProtoOrDie
    CanonicalDelimiter: ''
    BasedOnStyle:    google
ReflowComments:  true
SortIncludes:    false
SortUsingDeclarations: true
SpaceAfterCStyleCast: false
SpaceAfterLogicalNot: false
SpaceAfterTemplateKeyword: true
SpaceBeforeAssignmentOperators: true
SpaceBeforeCpp11BracedList: false
SpaceBeforeCtorInitializerColon: true
SpaceBeforeInheritanceColon: true
SpaceBeforeParens: ControlStatements
SpaceBeforeRangeBasedForLoopColon: true
SpaceInEmptyParentheses: false
SpacesBeforeTrailingComments: 4
SpacesInAngles:  false
SpacesInContainerLiterals: true
SpacesInCStyleCastParentheses: false
SpacesInParentheses: false
SpacesInSquareBrackets: false
Standard:        Auto
StatementMacros:
  - Q_UNUSED
  - QT_REQUIRE_VERSION
TabWidth:        8
UseTab:          Never
IndentPPDirectives: BeforeHash
...
`);

  vmake.success("%s", "[100%] success!");
};