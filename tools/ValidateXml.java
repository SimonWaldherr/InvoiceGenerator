import java.io.File;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.SchemaFactory;

class ValidateXml {
    public static void main(String[] args) throws Exception {
        var factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
        factory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "file");
        var schema = factory.newSchema(new File(args[0]));
        for (int i = 1; i < args.length; i++) {
            schema.newValidator().validate(new StreamSource(new File(args[i])));
        }
    }
}
