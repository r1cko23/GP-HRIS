

-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2024>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
CREATE PROCEDURE [dbo].[BILLINGGENERATETEMPLATE1headerPLK]
@billingreference nvarchar(20),
@idclient int

AS	
BEGIN
SET NOCOUNT ON;
  
declare @ssser float
declare @sssproer float
declare @ecc float
declare @phier float
declare @pager float
declare @sil float
declare @thirteenmonth float
 
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

select @ssser = sum(contributionssser) from BILLINGTABLE where  billingreference = @billingreference
select @sssproer = sum(contributionSSSERpro) from BILLINGTABLE where  billingreference = @billingreference
select @ecc = sum(contributionSSSECC) from BILLINGTABLE where  billingreference = @billingreference
select @phier = sum(contributionphilhealthER) from BILLINGTABLE where  billingreference = @billingreference
select @pager = sum(contributionPagibigER) from BILLINGTABLE where  billingreference = @billingreference
select @sil = sum(silp) from BILLINGTABLE where  billingreference = @billingreference
select @thirteenmonth = sum(thirteenmonth) from BILLINGTABLE where  billingreference = @billingreference



update tbl_Bill_TemplateDataheader
set ssser = @ssser
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set sssproer = @sssproer
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set ecc = @ecc
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set phier = @phier
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set pager = @pager
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set sil = @sil
where billingreference = @billingreference

update tbl_Bill_TemplateDataheader
set thirteenmonth = @thirteenmonth
where billingreference = @billingreference




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
