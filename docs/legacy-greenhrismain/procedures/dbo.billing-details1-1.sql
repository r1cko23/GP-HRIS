
-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of Billing
-- =============================================
CREATE PROCEDURE [dbo].[billing-details1-1] 
	-- Add the parameters for the stored procedure here
	@billingreference nvarchar(30), 
	@keytext nvarchar(150)
	
AS
BEGIN
	
SET NOCOUNT ON;

if (@keytext ='') 
begin
SELECT        
BILLINGTABLE.Employee_id
,IDBILLING
,idpayrollsum
, Employee.lname + N', ' + Employee.fname + N' ' + Employee.mname AS empname
, Employee.lname
, Employee.fname
, Employee.mname
, BillingGroup
, BillingDepartment
, billingsheetname
, fixrate
, noofhourswork1
, noofhourswork
, idbranchpositionp
, Date_Start
, Date_End
, payrolldate
, total
FROM            BILLINGTABLE INNER JOIN
                         GREENHRISMAIN.dbo.Employee ON BILLINGTABLE.Employee_id = Employee.Employee_id
where (billingreference = @billingreference )  
AND (billingstatus= 'Processed' ) 

order by billingsheetname,lname,fname

--order by BillingGroup,BillingDepartment,billingsheetname,lname,fname

   			  --OR (lname LIKE '%' + @keytext + '%' and fname LIKE '%' + @keytext + '%')

END

if (@keytext<>'') 
 BEGIN
	SELECT        
BILLINGTABLE.Employee_id
,IDBILLING
,idpayrollsum
, Employee.lname + N', ' + Employee.fname + N' ' + Employee.mname AS empname
, Employee.lname
, Employee.fname
, Employee.mname
, BillingGroup
, BillingDepartment
, billingsheetname
, fixrate
, noofhourswork1
, noofhourswork
, idbranchpositionp
, Date_Start
, Date_End
, payrolldate
, total
FROM            BILLINGTABLE INNER JOIN
                         Employee ON BILLINGTABLE.Employee_id = Employee.Employee_id
where (billingreference = @billingreference )  
AND (billingstatus= 'Processed' ) 
AND (lname LIKE '%' + @keytext + '%' OR fname LIKE '%' + @keytext + '%' or billinggroup LIKE '%' + @keytext + '%' or billingsheetname LIKE '%' + @keytext + '%' or billingdepartment LIKE '%' + @keytext + '%' )




order by BillingGroup,BillingDepartment,billingsheetname,lname,fname

   			  --OR (lname LIKE '%' + @keytext + '%' and fname LIKE '%' + @keytext + '%')

END

END



