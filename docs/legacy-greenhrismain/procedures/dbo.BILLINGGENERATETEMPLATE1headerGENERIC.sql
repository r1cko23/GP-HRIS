

-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2024>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
CREATE PROCEDURE [dbo].[BILLINGGENERATETEMPLATE1headerGENERIC]
@billingreference nvarchar(20),
@idclient int

AS	
BEGIN
SET NOCOUNT ON;
  
 
INSERT INTO tbl_Bill_TemplateDataheader(
billingreference,
ReferenceNo
,clientname
,DateCovered
,BillingDate
,PreparedByName
,PreparedByDesignation
,NotedByName
,NotedByDesignation
,AdminFee
,VAT
,ewt
,date_start
,payrollmonth
,departmentdesc
,PreparedByNameD


)
 --per department 
SELECT        BILLINGTABLE.billingreference, BILLINGTABLE.billingreference AS Expr1, client.companyname, FORMAT(BILLINGTABLE.Date_Start, 'MMM-dd-yyyy') + ' to ' + FORMAT(BILLINGTABLE.Date_End, 'MMM-dd-yyyy') 
                         AS FormattedDateRange, BILLINGTABLE.billingdate, client.billingpreparedby, client.billingpreparedbyrole, client.billingnotedby, client.billingnotedbyrole, BILLINGTABLE.adminfee, BILLINGTABLE.vat, BILLINGTABLE.ewt, 
                         BILLINGTABLE.Date_Start, BILLINGTABLE.payrollmonth, BILLINGTABLE.departmentdesc2, Department.preparedbydepartment
FROM            BILLINGTABLE INNER JOIN
                         client ON BILLINGTABLE.idclientp = client.idclient INNER JOIN
                         Department ON BILLINGTABLE.department_codep = Department.iddepartment

WHERE (dbo.BILLINGTABLE.billingstatus = N'processed') AND billingreference = @billingreference


--update other charges
--UPDATE t
--SET t.othercharges = COALESCE(od.total_amount, 0)
--FROM tbl_Bill_TemplateDataheader t
--OUTER APPLY (
--    SELECT SUM(o.amount) AS total_amount
--    FROM otherdeduction o
--    INNER JOIN BILLINGTABLE b 
--        ON o.idpayrollsum = b.idpayrollsum
--    WHERE b.billingreference = t.billingreference
--      AND o.codeotherdeduction = 250.12
--) od
--WHERE t.billingreference = @billingreference;






DECLARE @JsonResult NVARCHAR(MAX);

SELECT @JsonResult = (		
Select top 1 
	*,
	[ClientName] = clientname
from 	tbl_Bill_TemplateDataheader	 where billingreference = @billingreference
FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER);

SELECT @JsonResult;


		

		
END 
