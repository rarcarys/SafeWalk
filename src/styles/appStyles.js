import { StyleSheet } from 'react-native';
import { colors } from './theme';
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  medium: {
    fontWeight: '600',
    color: colors.ink
  },
  pressed: {
    opacity: 0.7
  },
  shell: {
    flex: 1,
    flexDirection: 'row'
  },
  main: {
    flex: 1,
    minWidth: 0
  },
  sidebar: {
    width: 210,
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 22
  },
  sidebarBrand: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    paddingLeft: 12
  },
  sideNav: {
    marginTop: 36,
    gap: 5
  },
  sideNavButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    borderRadius: 6
  },
  sideNavSelected: {
    backgroundColor: '#eaf0fc'
  },
  sideNavText: {
    fontSize: 14,
    color: colors.muted
  },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 'auto',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 20,
    paddingHorizontal: 8
  },
  profileShortcut: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink
  },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink
  },
  desktopHeaderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  headerLocation: {
    fontSize: 14,
    color: colors.ink
  },
  sosHeaderButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#efc8c8',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sosHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.red
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    width: 160,
    padding: 8,
    backgroundColor: colors.ink,
    borderRadius: 4,
    zIndex: 10
  },
  tooltipText: {
    color: colors.white,
    fontSize: 11,
    textAlign: 'center'
  },
  workspace: {
    flex: 1,
    minHeight: 0
  },
  desktopWorkspace: {
    flexDirection: 'row'
  },
  mapCanvas: {
    flex: 1,
    minHeight: 150,
    overflow: 'hidden',
    backgroundColor: '#e7ece8'
  },
  mapTiles: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  mapStreet: {
    position: 'absolute',
    zIndex: 1001,
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dfe1e5'
  },
  mapStreetText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.ink
  },
  homeMarker: {
    position: 'absolute',
    left: '63%',
    top: '24%',
    alignItems: 'center',
    gap: 4
  },
  homeMarkerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink
  },
  locationMarker: {
    position: 'absolute',
    left: '47%',
    top: '54%',
    alignItems: 'center'
  },
  locationHalo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#3169e822',
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationDot: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.blue,
    borderWidth: 3,
    borderColor: '#fff'
  },
  selfLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.white
  },
  locateButton: {
    position: 'absolute',
    zIndex: 1001,
    right: 11,
    bottom: 26,
    width: 38,
    height: 38,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dadce0'
  },
  mapAttribution: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#ffffffdb',
    color: '#62666a'
  },
  nativeAttribution: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: '#ffffffee',
    padding: 4,
    borderRadius: 3
  },
  nativeAttributionText: {
    fontSize: 8,
    color: '#62666a'
  },
  mapRouteStatus: {
    position: 'absolute',
    top: 15,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 9,
    backgroundColor: colors.white,
    borderRadius: 6
  },
  mapRouteText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '500'
  },
  blueDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.blue
  },
  tripPanel: {
    flexGrow: 0,
    flexShrink: 1,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.line
  },
  desktopTripPanel: {
    width: 360,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    flexShrink: 0
  },
  tripPanelContent: {
    paddingHorizontal: 20,
    paddingBottom: 10
  },
  desktopPanelContent: {
    paddingTop: 25,
    paddingHorizontal: 24
  },
  sheetHandle: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c6c8ce',
    alignSelf: 'center'
  },
  sheetToggle: {
    minHeight: 24,
    justifyContent: 'center'
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    paddingVertical: 10
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 14,
    lineHeight: 27
  },
  destinationField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 46,
    backgroundColor: '#f2f2f4',
    paddingLeft: 13,
    paddingRight: 4,
    borderRadius: 6
  },
  destinationInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 8
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    marginBottom: 9,
    minHeight: 25
  },
  originDot: {
    width: 9,
    height: 9,
    backgroundColor: colors.blue,
    borderRadius: 5
  },
  originText: {
    flex: 1,
    fontSize: 12,
    color: colors.muted
  },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12
  },
  routeSummaryText: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.ink
  },
  routeEstimate: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.muted
  },
  mapError: {
    color: colors.red,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  clearAddress: {
    width: 32,
    height: 32
  },
  savedPlaces: {
    flexDirection: 'row',
    gap: 22,
    paddingVertical: 13
  },
  savedPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 25
  },
  savedPlaceLabel: {
    fontSize: 12,
    color: colors.ink
  },
  modeControl: {
    flexDirection: 'row',
    borderRadius: 6,
    backgroundColor: '#f2f2f4',
    padding: 3,
    gap: 3,
    marginTop: 12
  },
  modeOption: {
    flex: 1,
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 5,
    borderRadius: 4
  },
  modeSelected: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7e7e9'
  },
  modeLabel: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: '500',
    flexShrink: 1
  },
  modeTime: {
    fontSize: 10,
    color: colors.muted
  },
  contactSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
    minHeight: 53
  },
  contactSelectorLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 12
  },
  actionButton: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.blue,
    borderRadius: 6
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center'
  },
  secondaryButton: {
    backgroundColor: '#f1f1f3',
    marginTop: 8
  },
  dangerButton: {
    backgroundColor: colors.red
  },
  sharingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 9
  },
  sharingStatusText: {
    fontSize: 10,
    color: colors.muted
  },
  desktopTripExtra: {
    borderTopWidth: 1,
    borderColor: colors.line,
    marginTop: 28,
    paddingTop: 22
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 15
  },
  tripState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blue
  },
  tripStateText: {
    fontSize: 11,
    color: colors.muted
  },
  tripNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 23,
    marginBottom: 10
  },
  tripNumber: {
    fontSize: 29,
    fontWeight: '600',
    color: colors.ink
  },
  minutesUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.muted
  },
  tripNumberLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 5
  },
  numberDivider: {
    width: 1,
    height: 39,
    backgroundColor: colors.line
  },
  delayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 12,
    paddingBottom: 3
  },
  delayLinkText: {
    fontSize: 10,
    color: colors.muted,
    flexShrink: 1
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 6
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5
  },
  bottomNavText: {
    fontSize: 10,
    color: '#95969b'
  },
  bottomNavActive: {
    color: colors.ink,
    fontWeight: '600'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  largeAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '600'
  },
  listScrollContent: {
    paddingVertical: 25,
    paddingHorizontal: 22,
    flexGrow: 1
  },
  listPage: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center'
  },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pageTitle: {
    fontSize: 27,
    fontWeight: '600',
    color: colors.ink
  },
  pageDescription: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 9,
    marginBottom: 25,
    lineHeight: 20
  },
  peopleList: {
    borderTopWidth: 1,
    borderColor: colors.line
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  personName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink
  },
  rowTitle: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 18
  },
  primaryContactLabel: {
    fontSize: 11,
    color: colors.muted
  },
  listFootnote: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 17
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.muted,
    lineHeight: 16
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
    paddingTop: 25,
    paddingBottom: 32
  },
  profileName: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 65,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  scenarioTime: {
    width: 46,
    color: colors.muted,
    fontSize: 12
  },
  version: {
    fontSize: 11,
    color: '#aaaab0',
    paddingTop: 30,
    paddingBottom: 15
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    marginTop: 23
  },
  logoutLabel: {
    fontSize: 14,
    color: colors.red
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    borderRadius: 6,
    backgroundColor: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 17
  },
  toastText: {
    fontSize: 12,
    color: colors.white,
    lineHeight: 19
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 23
  },
  modalHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 21,
    color: colors.ink,
    fontWeight: '600',
    flex: 1
  },
  modalDescription: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22
  },
  sosRecipients: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 20
  },
  modalFootnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    paddingTop: 17
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#b7b8be',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: colors.blue
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.blue
  }
});
export default s;
