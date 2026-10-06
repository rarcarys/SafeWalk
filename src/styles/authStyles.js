import { colors } from './theme';
import { StyleSheet } from 'react-native';
const {
  ink,
  muted
} = colors;
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    height: 68,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#e8e8eb'
  },
  brand: {
    fontSize: 23,
    fontWeight: '700',
    color: ink
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    justifyContent: 'center'
  },
  form: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center'
  },
  title: {
    fontSize: 29,
    fontWeight: '600',
    lineHeight: 36,
    color: ink,
    marginBottom: 30
  },
  field: {
    marginBottom: 19
  },
  label: {
    fontSize: 13,
    color: ink,
    fontWeight: '500',
    marginBottom: 8
  },
  inputWrapper: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#dadbe0',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  invalidInput: {
    borderColor: '#d43839'
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: ink,
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  passwordToggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  error: {
    color: '#c83233',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6
  },
  formError: {
    color: '#c83233',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18
  },
  link: {
    fontSize: 13,
    color: ink,
    fontWeight: '500'
  },
  button: {
    minHeight: 48,
    backgroundColor: ink,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 5
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  accountLink: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
    marginTop: 21
  },
  secondaryText: {
    fontSize: 13,
    color: muted
  },
  inlineLink: {
    paddingVertical: 7
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    minHeight: 38,
    marginBottom: 17
  },
  backLabel: {
    fontSize: 13,
    color: ink
  }
});
export default s;
