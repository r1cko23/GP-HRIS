-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of Billing
-- =============================================
CREATE PROCEDURE [dbo].[billing-forbilling1of2] 
	-- Add the parameters for the stored procedure here
	@keytext nvarchar(150),
	@idclient int,
	@idbranch int,
	@iddepartment int,
	@datestart date,
	@dateend  date,
	@payrolldate date
	
AS
BEGIN
	
	SET NOCOUNT ON;
	
if (@keytext ='') 
begin

	SELECT        payroll_summary.idclientp
	, client.companyname
	, payroll_summary.Date_Start
	, payroll_summary.Date_End
	, FORMAT(payroll_summary.payrolldate, 'MM/dd/yyyy') AS payrolldate
	, payroll_summary.datalocked
	, payroll_summary.idpayrollsum
	, payroll_summary.lname2
	, payroll_summary.fname2
	, payroll_summary.mname2
	, payroll_summary.Employee_id
	, payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N' ' + payroll_summary.mname2 AS empname
	, client_branch_position.BillingDepartment
	,payroll_summary.idbranchpositionp
	, payroll_summary.jobposition2
	
	
	,CASE  
--		WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
		WHEN payroll_summary.fixrate = 'Y' THEN 0	
		WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
	END AS noofhourswork

	, payroll_summary.idclientbranchp
	, payroll_summary.department_codep
	, client_branch_position.groupname
	, client_branch_position.sheetname
	, client_branch_position.jobposition
	, payroll_summary.fixrate
	, payroll_summary.dailyrate_payroll
	, client_branch_position.billingallowance


	FROM				client_branch_position INNER JOIN
                        client_branch INNER JOIN
                        payroll_summary INNER JOIN
                        client ON payroll_summary.idclientp = client.idclient ON 
						client_branch.idclientbranch = payroll_summary.idclientbranchp ON
						client_branch_position.idbranchposition = payroll_summary.idbranchpositionp

	WHERE        (payroll_summary.datalocked = N'Yes') 
	and payroll_summary.idclientp  = @idclient and Date_Start= @datestart and Date_End = @dateend
	and (transfertoforbilling = 'N') 
	and idclientbranchp = @idbranch
	and department_codep = @iddepartment
	and payroll_summary.payrolldate = @payrolldate
	order by lname2,fname2
end 

if (@keytext<>'') 
begin

SELECT        payroll_summary.idclientp
	, client.companyname
	, payroll_summary.Date_Start
	, payroll_summary.Date_End
	, FORMAT(payroll_summary.payrolldate, 'MM/dd/yyyy') AS payrolldate
	, payroll_summary.datalocked
	, payroll_summary.idpayrollsum
	, payroll_summary.lname2
	, payroll_summary.fname2
	, payroll_summary.mname2
	, payroll_summary.Employee_id
	, payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N' ' + payroll_summary.mname2 AS empname
	, client_branch_position.BillingDepartment
	, payroll_summary.idbranchpositionp
	, payroll_summary.jobposition2

	,CASE  
		--WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
		WHEN payroll_summary.fixrate = 'Y' THEN 0	
		WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
	END AS noofhourswork

	, payroll_summary.idclientbranchp
	, client_branch_position.groupname
	, client_branch_position.sheetname
	, client_branch_position.jobposition
	, payroll_summary.fixrate
	, payroll_summary.dailyrate_payroll
	, client_branch_position.billingallowance
	
	

	FROM            client_branch_position INNER JOIN
                         client_branch INNER JOIN
                         payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient ON 
						 client_branch.idclientbranch = payroll_summary.idclientbranchp ON
						 client_branch_position.idbranchposition = payroll_summary.idbranchpositionp

	WHERE payroll_summary.datalocked = N'Yes' 
	and payroll_summary.idclientp  = @idclient 
	and Date_Start= @datestart	
	and transfertoforbilling = 'N' 
	and idclientbranchp = @idbranch
	and department_codep = @iddepartment
	and Date_End = @dateend
	and payroll_summary.payrolldate = @payrolldate
	and (payroll_summary.departmentdesc2  LIKE '%' + @keytext + '%' OR  client_branch_position.jobposition LIKE '%' + @keytext + '%' or lname2 LIKE '%' + @keytext + '%' or fname2 LIKE '%' + @keytext + '%' or client_branch_position.groupname  LIKE '%' + @keytext + '%' or client_branch_position.sheetname  LIKE '%' + @keytext + '%' ) 

	order by lname2,fname2

end 




END



